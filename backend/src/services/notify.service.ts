import prisma from '../lib/prisma';
import { outbound } from '../lib/outbound';
import { addMinutes, formatJkt, jktParts } from '../lib/time';
import { getStoreSetting } from './settings.service';

/**
 * Notifikasi otomatis ke pelanggan lewat WhatsApp (jika WhatsApp terhubung & diaktifkan).
 * Tidak pernah melempar error agar alur booking utama tidak terganggu.
 */

export type WaConfig = {
  /** Pesan masuk WhatsApp dibalas AI (atau masuk antrean admin bila sesi diambil alih). */
  autoReply: boolean;
  /** Kirim pesan saat booking terkonfirmasi / dibatalkan. */
  notifyBooking: boolean;
  /** Kirim pengingat sebelum jam main. */
  notifyReminder: boolean;
  /** Berapa menit sebelum mulai pengingat dikirim. */
  reminderMins: number;
};

export const DEFAULT_WA_CONFIG: WaConfig = { autoReply: true, notifyBooking: true, notifyReminder: true, reminderMins: 60 };

export const getWaConfig = async (): Promise<WaConfig> => {
  const row = await prisma.channel.findUnique({ where: { type: 'whatsapp' } });
  const cfg = (row?.config as Partial<WaConfig> | null) ?? {};
  return { ...DEFAULT_WA_CONFIG, ...cfg };
};

type BookingForMsg = {
  bookingCode: string | null;
  startTime: Date;
  endTime: Date;
  durationHours: number;
  totalPrice: number;
  cancelReason?: string | null;
  station: { name: string };
};

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

/** Format pesan booking untuk WhatsApp. */
export const fmtBookingWa = (b: BookingForMsg, kind: 'confirmed' | 'reminder' | 'cancelled' | 'pending') => {
  const when = `${formatJkt(b.startTime)} – ${jktParts(b.endTime).timeStr} WIB`;
  const detail = `🎮 *${b.station.name}*\n📅 ${when} (${b.durationHours} jam)\n💰 ${rupiah(b.totalPrice)}\n🔖 Kode: *${b.bookingCode ?? '-'}*`;
  switch (kind) {
    case 'confirmed':
      return `✅ *Booking terkonfirmasi!*\n\n${detail}\n\nTunjukkan kode booking ke kasir saat datang ya kak. Sampai ketemu! 🙌`;
    case 'pending':
      return `🕐 *Booking menunggu pembayaran*\n\n${detail}\n\nSelesaikan pembayaran QRIS sebelum batas waktu agar slot tidak dilepas ya kak.`;
    case 'reminder':
      return `⏰ *Pengingat main*\n\nHai kak, jadwal mainmu sebentar lagi:\n\n${detail}\n\nDatang 10 menit lebih awal ya!`;
    case 'cancelled':
      return `❌ *Booking dibatalkan*\n\n${detail}${b.cancelReason ? `\n\nAlasan: ${b.cancelReason}` : ''}\n\nMau pilih jadwal lain? Balas pesan ini saja, kak.`;
  }
};

/** Kirim notifikasi status booking ke WhatsApp pelanggan. */
export const notifyBookingWa = async (bookingId: string, kind: 'confirmed' | 'cancelled') => {
  try {
    if (!outbound.whatsapp || !outbound.isWhatsAppReady()) return;
    const cfg = await getWaConfig();
    if (!cfg.notifyBooking) return;
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        station: { select: { name: true } },
        customer: { select: { whatsapp: true } },
        chatSession: { select: { channel: true } },
        payment: { select: { status: true } },
      },
    });
    if (!b?.customer.whatsapp) return;
    // Booking AI di chat WhatsApp yang langsung terkonfirmasi (cash) sudah dapat kartu di percakapan.
    // Tapi konfirmasi SETELAH bayar QRIS tetap dikirim supaya pelanggan tahu pembayarannya masuk.
    const paidNow = b.payment?.status === 'paid';
    if (kind === 'confirmed' && b.source === 'ai' && b.chatSession?.channel === 'whatsapp' && !paidNow) return;
    await outbound.whatsapp(b.customer.whatsapp, fmtBookingWa(b, kind));
  } catch (e) {
    console.error('[notify] gagal kirim WA booking:', (e as Error)?.message);
  }
};

/** Kirim pengingat untuk booking yang akan dimulai (dipanggil job tiap menit). */
export const sendDueReminders = async () => {
  if (!outbound.whatsapp || !outbound.isWhatsAppReady()) return 0;
  const cfg = await getWaConfig();
  if (!cfg.notifyReminder) return 0;
  await getStoreSetting(); // pastikan setting ter-cache (zona waktu/jam buka)
  const now = new Date();
  const due = await prisma.booking.findMany({
    where: { status: 'confirmed', reminderSentAt: null, startTime: { gt: now, lte: addMinutes(now, cfg.reminderMins) } },
    include: { station: { select: { name: true } }, customer: { select: { whatsapp: true } } },
    take: 20,
  });
  let sent = 0;
  for (const b of due) {
    try {
      await outbound.whatsapp(b.customer.whatsapp, fmtBookingWa(b, 'reminder'));
      sent++;
    } catch (e) {
      console.error('[notify] gagal kirim pengingat:', (e as Error)?.message);
    }
    // Tandai walau gagal kirim, supaya tidak dicoba terus setiap menit.
    await prisma.booking.update({ where: { id: b.id }, data: { reminderSentAt: new Date() } });
  }
  return sent;
};
