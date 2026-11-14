import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import pino from 'pino';
import {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from '@whiskeysockets/baileys';
import prisma from '../lib/prisma';
import { outbound } from '../lib/outbound';
import { HttpError } from '../lib/http';
import { logActivity } from '../lib/activity';
import { DEFAULT_WA_CONFIG, fmtBookingWa, getWaConfig, type WaConfig } from './notify.service';
import { getOrCreateCustomerSession, handleCustomerMessage } from './chat.service';

/**
 * Koneksi WhatsApp lewat protokol WhatsApp Web (scan QR, seperti WhatsApp Web di browser).
 * Catatan: ini klien tidak resmi — gunakan nomor khusus bisnis, jangan untuk spam.
 */

const AUTH_DIR = path.resolve(process.env.WA_SESSION_DIR || path.join(process.cwd(), '.wa-session'));
const MAX_QR = 6; // ±2 menit; setelah itu berhenti agar tidak berputar terus
const logger = pino({ level: process.env.WA_LOG_LEVEL || 'silent' });

export type WaStatus = 'disconnected' | 'connecting' | 'qr' | 'connected';

const DEFAULT_CONFIG = DEFAULT_WA_CONFIG;

const state: {
  status: WaStatus;
  qr: string | null;
  qrAt: number | null;
  qrCount: number;
  phone: string | null;
  name: string | null;
  connectedAt: Date | null;
  lastError: string | null;
} = { status: 'disconnected', qr: null, qrAt: null, qrCount: 0, phone: null, name: null, connectedAt: null, lastError: null };

let sock: WASocket | null = null;
let starting: Promise<void> | null = null;
let stopRequested = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let retry = 0;

// ---------------------------------------------------------------------
// Konfigurasi (disimpan di tabel Channel type=whatsapp)
// ---------------------------------------------------------------------

export const updateWaConfig = async (patch: Partial<WaConfig>, adminId?: string) => {
  const config = { ...(await getWaConfig()), ...patch };
  await prisma.channel.upsert({
    where: { type: 'whatsapp' },
    create: { type: 'whatsapp', name: 'WhatsApp', config },
    update: { config },
  });
  await logActivity('whatsapp.config', 'Channel', 'whatsapp', patch, adminId);
  return config;
};

const syncChannel = (data: { status: string; phoneNumber?: string | null }) =>
  prisma.channel
    .upsert({
      where: { type: 'whatsapp' },
      create: { type: 'whatsapp', name: 'WhatsApp', status: data.status, phoneNumber: data.phoneNumber ?? null, config: DEFAULT_CONFIG, lastSyncAt: new Date() },
      update: { status: data.status, ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber } : {}), lastSyncAt: new Date() },
    })
    .catch((e) => console.error('[wa] gagal sinkron channel:', e?.message));

// ---------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------

export const getWaStatus = async () => ({
  status: state.status,
  qr: state.status === 'qr' ? state.qr : null,
  qrExpiresIn: state.status === 'qr' && state.qrAt ? Math.max(0, 20 - Math.round((Date.now() - state.qrAt) / 1000)) : null,
  phone: state.phone,
  name: state.name,
  connectedAt: state.connectedAt,
  lastError: state.lastError,
  hasSession: await hasSession(),
  config: await getWaConfig(),
});

export const isWaConnected = () => state.status === 'connected' && !!sock;

const hasSession = async () => {
  try {
    await fs.access(path.join(AUTH_DIR, 'creds.json'));
    return true;
  } catch {
    return false;
  }
};

const clearSession = async () => {
  await fs.rm(AUTH_DIR, { recursive: true, force: true }).catch(() => undefined);
};

// ---------------------------------------------------------------------
// Koneksi
// ---------------------------------------------------------------------

export const startWhatsApp = async () => {
  if (state.status === 'connected' && sock) return;
  if (starting) return starting;
  stopRequested = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);

  starting = (async () => {
    state.status = 'connecting';
    state.lastError = null;
    state.qrCount = 0;
    await fs.mkdir(AUTH_DIR, { recursive: true });
    const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const version = await fetchLatestBaileysVersion()
      .then((v) => v.version)
      .catch(() => undefined);

    const socket = makeWASocket({
      auth,
      ...(version ? { version } : {}),
      logger,
      browser: Browsers.macOS('Desktop'),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    sock = socket;

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (u) => {
      if (sock !== socket) return; // event dari socket lama

      if (u.qr) {
        state.qrCount += 1;
        if (state.qrCount > MAX_QR) {
          state.lastError = 'QR tidak dipindai. Klik "Hubungkan" untuk mencoba lagi.';
          await stopSocket(false);
          state.status = 'disconnected';
          return;
        }
        state.status = 'qr';
        state.qr = u.qr;
        state.qrAt = Date.now();
      }

      if (u.connection === 'open') {
        const id = socket.user?.id ?? '';
        state.status = 'connected';
        state.qr = null;
        state.phone = id.split(':')[0].split('@')[0] || null;
        state.name = socket.user?.name ?? socket.user?.verifiedName ?? null;
        state.connectedAt = new Date();
        state.lastError = null;
        retry = 0;
        console.log(`[wa] Terhubung sebagai ${state.phone}`);
        await syncChannel({ status: 'connected', phoneNumber: state.phone });
      }

      if (u.connection === 'close') {
        const code = (u.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        sock = null;
        state.qr = null;

        if (code === DisconnectReason.loggedOut) {
          console.log('[wa] Perangkat di-logout dari HP — sesi dihapus');
          await clearSession();
          Object.assign(state, { status: 'disconnected', phone: null, name: null, connectedAt: null, lastError: 'Perangkat di-logout dari WhatsApp di HP.' });
          await syncChannel({ status: 'disconnected', phoneNumber: null });
          return;
        }
        if (stopRequested) {
          state.status = 'disconnected';
          await syncChannel({ status: 'disconnected' });
          return;
        }
        // restartRequired (515) muncul tepat setelah scan QR → langsung sambung ulang.
        const delay = code === DisconnectReason.restartRequired ? 0 : Math.min(30_000, 2_000 * 2 ** retry++);
        state.status = 'connecting';
        state.lastError = code && code !== DisconnectReason.restartRequired ? `Koneksi terputus (kode ${code}), menyambung ulang…` : null;
        await syncChannel({ status: 'error' });
        reconnectTimer = setTimeout(() => {
          starting = null;
          startWhatsApp().catch((e) => console.error('[wa] reconnect gagal:', e?.message));
        }, delay);
      }
    });

    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        handleIncoming(m).catch((e) => console.error('[wa] gagal memproses pesan masuk:', e?.message));
      }
    });
  })().finally(() => {
    starting = null;
  });
  return starting;
};

const stopSocket = async (logout: boolean) => {
  stopRequested = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const s = sock;
  sock = null;
  if (!s) return;
  try {
    if (logout) await s.logout();
    else s.end(undefined);
  } catch {
    // abaikan
  }
};

/** Putuskan sambungan & hapus sesi (harus scan QR lagi). */
export const logoutWhatsApp = async (adminId?: string) => {
  await stopSocket(true);
  await clearSession();
  Object.assign(state, { status: 'disconnected', qr: null, phone: null, name: null, connectedAt: null, lastError: null });
  await syncChannel({ status: 'disconnected', phoneNumber: null });
  await logActivity('whatsapp.logout', 'Channel', 'whatsapp', null, adminId);
};

/** Sambungkan otomatis saat server menyala jika sesi sudah ada. */
export const autoStartWhatsApp = async () => {
  if (process.env.WA_DISABLED === 'true') return;
  if (await hasSession()) {
    console.log('[wa] Sesi ditemukan, menyambungkan…');
    startWhatsApp().catch((e) => console.error('[wa] auto-start gagal:', e?.message));
  }
};

// ---------------------------------------------------------------------
// Kirim pesan (antrean dengan jeda agar tidak dianggap spam)
// ---------------------------------------------------------------------

let queue: Promise<unknown> = Promise.resolve();
let lastSentAt = 0;
const MIN_GAP_MS = 1500;

const toJid = (phone: string) => {
  let n = phone.replace(/\D/g, '');
  if (n.startsWith('0')) n = `62${n.slice(1)}`;
  return `${n}@s.whatsapp.net`;
};

const rawSend = async (jid: string, text: string) => {
  if (!sock || state.status !== 'connected') throw new HttpError(503, 'WhatsApp belum terhubung. Scan QR di Pengaturan → WhatsApp.');
  const wait = lastSentAt + MIN_GAP_MS + Math.random() * 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  await sock.sendMessage(jid, { text });
  lastSentAt = Date.now();
};

/** Kirim teks ke nomor (format 62xxx / 08xxx). Diantrikan berurutan. */
export const sendWhatsAppText = (phone: string, text: string): Promise<void> => {
  const job = queue.then(() => rawSend(toJid(phone), text));
  queue = job.catch(() => undefined);
  return job;
};

/** Kirim ke JID asli (untuk membalas chat masuk, termasuk alamat @lid). */
const sendToJid = (jid: string, text: string): Promise<void> => {
  const job = queue.then(() => rawSend(jid, text));
  queue = job.catch(() => undefined);
  return job;
};

/** Cek apakah nomor terdaftar di WhatsApp. */
export const checkWhatsAppNumber = async (phone: string) => {
  if (!sock || state.status !== 'connected') throw new HttpError(503, 'WhatsApp belum terhubung');
  const [res] = (await sock.onWhatsApp(toJid(phone).split('@')[0])) ?? [];
  return !!res?.exists;
};

outbound.whatsapp = sendWhatsAppText;
outbound.isWhatsAppReady = isWaConnected;

// ---------------------------------------------------------------------
// Pesan masuk → AI / admin
// ---------------------------------------------------------------------

const extractText = (m: WAMessage) => {
  const msg = m.message;
  if (!msg) return '';
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.videoMessage?.caption ??
    msg.buttonsResponseMessage?.selectedDisplayText ??
    msg.listResponseMessage?.title ??
    msg.ephemeralMessage?.message?.conversation ??
    msg.ephemeralMessage?.message?.extendedTextMessage?.text ??
    ''
  );
};

async function handleIncoming(m: WAMessage) {
  if (!m.message || m.key.fromMe) return;
  const jid = m.key.remoteJid;
  if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@newsletter') || jid.endsWith('@broadcast')) return;
  if (m.message.protocolMessage || m.message.reactionMessage) return;

  // Alamat @lid (privasi WhatsApp baru) → ambil nomor asli dari field alternatif bila ada.
  const key = m.key as typeof m.key & { senderPn?: string; remoteJidAlt?: string };
  const phoneJid = jid.endsWith('@s.whatsapp.net') ? jid : (key.senderPn ?? key.remoteJidAlt ?? null);
  if (!phoneJid?.endsWith('@s.whatsapp.net')) {
    console.warn(`[wa] Pesan dari ${jid} dilewati: nomor telepon tidak diketahui`);
    return;
  }
  const phone = phoneJid.split('@')[0].split(':')[0];

  const config = await getWaConfig();
  if (!config.autoReply) return;

  const text = extractText(m).trim();
  if (!text) {
    await sendToJid(jid, 'Maaf kak, saat ini aku baru bisa membaca pesan teks ya 🙏').catch(() => undefined);
    return;
  }

  // Pelanggan dikenali dari nomor WA; jika belum terdaftar dibuatkan akun otomatis.
  let customer = await prisma.customer.findUnique({ where: { whatsapp: phone } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: (m.pushName || '').trim().slice(0, 60) || `Pelanggan ${phone.slice(-4)}`,
        whatsapp: phone,
        password: await bcrypt.hash(crypto.randomBytes(12).toString('hex'), 10),
        tags: ['whatsapp'],
      },
    });
  }

  const { session } = await getOrCreateCustomerSession(customer.id, 'whatsapp', { silentGreeting: true });

  await sock?.readMessages([m.key]).catch(() => undefined);
  await sock?.sendPresenceUpdate('composing', jid).catch(() => undefined);

  let result;
  try {
    result = await handleCustomerMessage(session.id, customer.id, text, { externalId: m.key.id ?? undefined });
  } catch (e: unknown) {
    // Pesan duplikat (WA kadang mengirim ulang event) → abaikan.
    if ((e as { code?: string })?.code === 'P2002') return;
    throw e;
  } finally {
    await sock?.sendPresenceUpdate('paused', jid).catch(() => undefined);
  }

  for (const r of result.replies) {
    if (r.sender === 'ai' && r.type === 'text') await sendToJid(jid, r.message);
    else if (r.type === 'booking_card' && r.bookingId) {
      const b = await prisma.booking.findUnique({ where: { id: r.bookingId }, include: { station: true } });
      if (b) await sendToJid(jid, fmtBookingWa(b, 'confirmed'));
    }
  }
}
