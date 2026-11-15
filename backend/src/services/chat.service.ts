import { ChatSession, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { badRequest, forbidden, notFound } from '../lib/http';
import { notifyAdmins } from '../lib/activity';
import { outbound } from '../lib/outbound';
import { jktParts } from '../lib/time';
import { getAgentConfig, isWithinActiveHours } from './ai/context';
import { runChatTurn, summarizeSession, type HistoryItem } from './ai/orchestrator';

export const sessionInclude = {
  customer: { select: { id: true, name: true, whatsapp: true, tier: true, avatarUrl: true } },
  assignedAdmin: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.ChatSessionInclude;

const preview = (s: string) => s.replace(/\s+/g, ' ').slice(0, 200);

const addEvent = (sessionId: string, type: string, note?: string | null, adminId?: string | null) =>
  prisma.chatSessionEvent.create({ data: { sessionId, type, note: note ?? null, adminId: adminId ?? null } });

const addSystemMessage = (sessionId: string, message: string) =>
  prisma.chatMessage.create({ data: { sessionId, sender: 'system', type: 'system', message } });

// ---------------------------------------------------------------------
// Sesi
// ---------------------------------------------------------------------

/**
 * Ambil sesi aktif pelanggan di channel tertentu atau buat baru (dengan sapaan AI).
 * silentGreeting: jangan simpan sapaan (WhatsApp — AI langsung menjawab pesan pertama).
 */
export const getOrCreateCustomerSession = async (customerId: string, channel = 'web', opts: { silentGreeting?: boolean } = {}) => {
  const existing = await prisma.chatSession.findFirst({
    where: { customerId, channel, status: { not: 'closed' } },
    orderBy: { updatedAt: 'desc' },
    include: sessionInclude,
  });
  if (existing) return { session: existing, created: false };

  const config = await getAgentConfig('chat');
  const session = await prisma.chatSession.create({
    data: { customerId, channel, status: 'ai_pilot' },
    include: sessionInclude,
  });
  await addEvent(session.id, 'created');

  if (config.isActive && config.greetingMessage && !opts.silentGreeting) {
    await prisma.chatMessage.create({ data: { sessionId: session.id, sender: 'ai', message: config.greetingMessage } });
    await prisma.chatSession.update({
      where: { id: session.id },
      data: { lastMessage: preview(config.greetingMessage), lastMessageAt: new Date(), lastSender: 'ai', unreadByCustomer: 1 },
    });
  }
  return { session, created: true };
};

export const assertSessionAccess = async (sessionId: string, user: { id: string; role: string }) => {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound('Sesi chat tidak ditemukan');
  if (user.role === 'CUSTOMER' && session.customerId !== user.id) throw forbidden('Ini bukan sesi chat milikmu');
  return session;
};

/** Relasi yang ikut dikirim bersama pesan (kartu booking & QRIS butuh data booking + pembayaran). */
export const messageInclude = {
  admin: { select: { id: true, name: true, avatarUrl: true } },
  booking: {
    select: {
      id: true,
      bookingCode: true,
      status: true,
      startTime: true,
      endTime: true,
      totalPrice: true,
      station: { select: { name: true } },
      payment: { select: { status: true, method: true, amount: true, qrUrl: true, expiredAt: true } },
    },
  },
} satisfies Prisma.ChatMessageInclude;

export const listMessages = (sessionId: string, opts: { after?: Date; before?: Date; limit?: number }) =>
  prisma.chatMessage
    .findMany({
      where: {
        sessionId,
        ...(opts.after ? { createdAt: { gt: opts.after } } : {}),
        ...(opts.before ? { createdAt: { lt: opts.before } } : {}),
      },
      include: messageInclude,
      // Tanpa `after`: ambil N terbaru lalu dibalik supaya urut naik.
      orderBy: { createdAt: opts.after ? 'asc' : 'desc' },
      take: Math.min(opts.limit ?? 50, 200),
    })
    .then((rows) => (opts.after ? rows : rows.reverse()));

// ---------------------------------------------------------------------
// Pesan pelanggan → AI
// ---------------------------------------------------------------------

const loadHistory = async (sessionId: string, beforeId: string): Promise<HistoryItem[]> => {
  const rows = await prisma.chatMessage.findMany({
    where: { sessionId, id: { not: beforeId }, sender: { in: ['customer', 'ai', 'admin'] }, type: 'text' },
    orderBy: { createdAt: 'desc' },
    take: 14,
    select: { sender: true, message: true },
  });
  return rows.reverse().map((m) => ({ role: m.sender === 'customer' ? 'user' : 'model', text: m.message }));
};

export const handleCustomerMessage = async (sessionId: string, customerId: string, text: string, opts: { externalId?: string } = {}) => {
  const message = text.trim();
  if (!message) throw badRequest('Pesan tidak boleh kosong');

  let session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound('Sesi chat tidak ditemukan');
  if (session.customerId !== customerId) throw forbidden('Ini bukan sesi chat milikmu');

  if (session.status === 'closed') {
    session = await prisma.chatSession.update({ where: { id: sessionId }, data: { status: 'ai_pilot', closedAt: null } });
    await addEvent(sessionId, 'reopened', 'Dibuka kembali oleh pelanggan');
  }

  // externalId (id pesan WhatsApp) unik → event ganda dari WA otomatis ditolak.
  const customerMessage = await prisma.chatMessage.create({ data: { sessionId, sender: 'customer', message, externalId: opts.externalId ?? null } });
  const isFirstCustomerMessage = !session.lastSender || (session.lastSender === 'ai' && !session.title);

  session = await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      lastMessage: preview(message),
      lastMessageAt: customerMessage.createdAt,
      lastSender: 'customer',
      unreadByAdmin: { increment: 1 },
    },
  });

  const config = await getAgentConfig('chat');
  const aiShouldReply = session.status === 'ai_pilot' && config.isActive && config.autoReply && isWithinActiveHours(config);

  if (!aiShouldReply) {
    if (session.status === 'human' && session.assignedAdminId) {
      await notifyAdmins('new_chat', `Pesan baru dari pelanggan`, preview(message), `/dashboard/livechat?session=${sessionId}`, session.assignedAdminId);
    } else if (isFirstCustomerMessage || session.status === 'ai_pilot') {
      await notifyAdmins('new_chat', 'Chat baru menunggu admin', preview(message), `/dashboard/livechat?session=${sessionId}`);
    }
    return { session, customerMessage, replies: [] as Awaited<ReturnType<typeof prisma.chatMessage.create>>[], ai: null };
  }

  // Jalankan pipeline multi-agent.
  const history = await loadHistory(sessionId, customerMessage.id);
  const turn = await runChatTurn({
    message,
    history,
    customerId,
    sessionId,
    channel: session.channel,
    previousIntent: session.intent,
  });

  const replies = [];
  replies.push(
    await prisma.chatMessage.create({
      data: {
        sessionId,
        sender: 'ai',
        message: turn.reply,
        metadata: {
          agent: turn.agent,
          intent: turn.intent,
          routedBy: turn.routedBy,
          latencyMs: turn.latencyMs,
          model: turn.model,
          tools: turn.toolCalls.map((t) => t.name),
        },
      },
      include: messageInclude,
    }),
  );

  for (const bookingId of turn.bookingIds) {
    const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { bookingCode: true } });
    replies.push(
      await prisma.chatMessage.create({
        data: { sessionId, sender: 'ai', type: 'booking_card', message: `Booking ${b?.bookingCode ?? ''} berhasil dibuat`, bookingId },
        include: messageInclude,
      }),
    );
    await addEvent(sessionId, 'booking_created', b?.bookingCode ?? bookingId);
  }

  // QRIS dikirim sebagai pesan gambar (web: kartu QR, WhatsApp: foto QR).
  for (const bookingId of turn.qrisBookingIds) {
    const p = await prisma.payment.findUnique({
      where: { bookingId },
      select: { amount: true, qrUrl: true, expiredAt: true, booking: { select: { bookingCode: true } } },
    });
    if (!p?.qrUrl) continue;
    const until = p.expiredAt ? ` · bayar sebelum ${jktParts(p.expiredAt).timeStr} WIB` : '';
    replies.push(
      await prisma.chatMessage.create({
        data: {
          sessionId,
          sender: 'ai',
          type: 'payment_qris',
          message: `QRIS ${p.booking.bookingCode ?? ''} · Rp${p.amount.toLocaleString('id-ID')}${until}`,
          attachmentUrl: p.qrUrl.startsWith('http') ? p.qrUrl : null,
          bookingId,
        },
        include: messageInclude,
      }),
    );
  }

  const data: Prisma.ChatSessionUpdateInput = {
    intent: turn.intent,
    priority: turn.priority,
    lastMessage: preview(turn.reply),
    lastMessageAt: new Date(),
    lastSender: 'ai',
    unreadByCustomer: { increment: replies.length },
  };

  if (turn.handoff) {
    data.status = 'human';
    data.priority = 'high';
    replies.push(await addSystemMessage(sessionId, 'Percakapan diteruskan ke admin.'));
    await addEvent(sessionId, 'takeover', `Handoff AI: ${turn.handoffReason ?? '-'}`);
    await notifyAdmins(
      'handoff',
      'AI meneruskan chat ke admin',
      `${turn.handoffReason ?? ''} — "${preview(message)}"`,
      `/dashboard/livechat?session=${sessionId}`,
    );
  } else {
    // Admin tidak perlu membaca pesan yang sudah dijawab AI.
    data.unreadByAdmin = 0;
  }

  session = await prisma.chatSession.update({ where: { id: sessionId }, data });

  // Ringkasan sesi diperbarui di latar belakang (tidak menahan respons).
  const count = await prisma.chatMessage.count({ where: { sessionId, sender: 'customer' } });
  if (!session.title || count % 5 === 0 || turn.handoff || turn.bookingIds.length) {
    void summarizeSession(sessionId).catch(() => undefined);
  }

  return {
    session,
    customerMessage,
    replies,
    ai: {
      agent: turn.agent,
      intent: turn.intent,
      routedBy: turn.routedBy,
      handoff: turn.handoff,
      latencyMs: turn.latencyMs,
      model: turn.model,
      status: turn.status,
    },
  };
};

// ---------------------------------------------------------------------
// Aksi admin
// ---------------------------------------------------------------------

export const takeoverSession = async (sessionId: string, adminId: string) => {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound('Sesi chat tidak ditemukan');
  const updated = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { status: 'human', assignedAdminId: adminId, takenOverAt: new Date(), closedAt: null },
    include: sessionInclude,
  });
  await addEvent(sessionId, 'takeover', null, adminId);
  const name = updated.assignedAdmin?.name;
  await addSystemMessage(sessionId, name ? `Admin ${name} bergabung ke percakapan.` : 'Admin bergabung ke percakapan.');
  return updated;
};

export const releaseSession = async (sessionId: string, adminId: string) => {
  const updated = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { status: 'ai_pilot', assignedAdminId: null, priority: 'normal' },
    include: sessionInclude,
  });
  await addEvent(sessionId, 'release', null, adminId);
  await addSystemMessage(sessionId, 'Jadwal.an AI kembali membantu percakapan ini.');
  return updated;
};

export const closeSession = async (sessionId: string, adminId?: string | null) => {
  const updated = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { status: 'closed', closedAt: new Date(), unreadByAdmin: 0 },
    include: sessionInclude,
  });
  await addEvent(sessionId, 'closed', null, adminId);
  await addSystemMessage(sessionId, 'Percakapan ditutup. Kirim pesan lagi kapan saja untuk membuka kembali.');
  void summarizeSession(sessionId).catch(() => undefined);
  return updated;
};

export const reopenSession = async (sessionId: string, adminId?: string | null) => {
  const updated = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { status: adminId ? 'human' : 'ai_pilot', closedAt: null, ...(adminId ? { assignedAdminId: adminId } : {}) },
    include: sessionInclude,
  });
  await addEvent(sessionId, 'reopened', null, adminId);
  return updated;
};

export const assignSession = async (sessionId: string, targetAdminId: string, byAdminId: string) => {
  const admin = await prisma.user.findFirst({ where: { id: targetAdminId, role: 'ADMIN', isActive: true } });
  if (!admin) throw notFound('Admin tujuan tidak ditemukan');
  const updated = await prisma.chatSession.update({
    where: { id: sessionId },
    data: { assignedAdminId: targetAdminId, status: 'human', takenOverAt: new Date() },
    include: sessionInclude,
  });
  await addEvent(sessionId, 'assigned', `Ditugaskan ke ${admin.name}`, byAdminId);
  await notifyAdmins('new_chat', 'Chat ditugaskan kepadamu', updated.lastMessage ?? undefined, `/dashboard/livechat?session=${sessionId}`, targetAdminId);
  return updated;
};

export const sendAdminMessage = async (
  sessionId: string,
  adminId: string,
  input: { message: string; type?: string; attachmentUrl?: string | null; bookingId?: string | null },
) => {
  let session: ChatSession | null = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound('Sesi chat tidak ditemukan');

  // Admin membalas saat AI masih aktif → otomatis ambil alih.
  if (session.status !== 'human' || session.assignedAdminId !== adminId) {
    if (session.status !== 'human') await takeoverSession(sessionId, adminId);
    else if (!session.assignedAdminId) {
      await prisma.chatSession.update({ where: { id: sessionId }, data: { assignedAdminId: adminId } });
    }
  }

  const msg = await prisma.chatMessage.create({
    data: {
      sessionId,
      sender: 'admin',
      adminId,
      type: input.type ?? 'text',
      message: input.message,
      attachmentUrl: input.attachmentUrl ?? null,
      bookingId: input.bookingId ?? null,
    },
    include: { admin: { select: { id: true, name: true, avatarUrl: true } } },
  });

  session = await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      lastMessage: preview(input.message),
      lastMessageAt: msg.createdAt,
      lastSender: 'admin',
      unreadByCustomer: { increment: 1 },
      unreadByAdmin: 0,
    },
  });

  // Sesi dari WhatsApp → balasan admin diteruskan ke WhatsApp pelanggan.
  let deliveryError: string | null = null;
  if (session.channel === 'whatsapp') {
    const customer = await prisma.customer.findUnique({ where: { id: session.customerId }, select: { whatsapp: true } });
    try {
      if (!outbound.whatsapp || !outbound.isWhatsAppReady()) throw new Error('WhatsApp belum terhubung');
      await outbound.whatsapp(customer!.whatsapp, input.message);
      await prisma.chatMessage.update({ where: { id: msg.id }, data: { status: 'delivered' } });
    } catch (e) {
      deliveryError = `Pesan tersimpan, tapi gagal dikirim ke WhatsApp: ${(e as Error).message}`;
      await prisma.chatMessage.update({ where: { id: msg.id }, data: { status: 'failed' } });
    }
  }
  return { session, message: msg, deliveryError };
};

export const markSessionRead = async (sessionId: string, reader: 'admin' | 'customer') => {
  const now = new Date();
  if (reader === 'admin') {
    await prisma.$transaction([
      prisma.chatMessage.updateMany({ where: { sessionId, sender: 'customer', readAt: null }, data: { readAt: now, status: 'read' } }),
      prisma.chatSession.update({ where: { id: sessionId }, data: { unreadByAdmin: 0 } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.chatMessage.updateMany({ where: { sessionId, sender: { in: ['ai', 'admin'] }, readAt: null }, data: { readAt: now, status: 'read' } }),
      prisma.chatSession.update({ where: { id: sessionId }, data: { unreadByCustomer: 0 } }),
    ]);
  }
};
