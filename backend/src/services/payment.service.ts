import crypto from 'node:crypto';
import { CoreApi } from 'midtrans-client';
import prisma from '../lib/prisma';
import { badRequest, HttpError, notFound } from '../lib/http';
import { logActivity, notifyAdmins } from '../lib/activity';
import { addMinutes } from '../lib/time';
import { getStoreSetting } from './settings.service';
import { updateBookingStatus } from './booking.service';

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

let core: CoreApi | null = null;
const getCore = () => {
  if (!process.env.MIDTRANS_SERVER_KEY) {
    throw new HttpError(503, 'Pembayaran QRIS belum dikonfigurasi (MIDTRANS_SERVER_KEY kosong)');
  }
  core ??= new CoreApi({
    isProduction,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
  });
  return core;
};

/** Status Midtrans → status Payment internal. */
const mapStatus = (transactionStatus: string, fraudStatus?: string) => {
  switch (transactionStatus) {
    case 'capture':
      return fraudStatus === 'challenge' ? 'pending' : 'paid';
    case 'settlement':
      return 'paid';
    case 'pending':
      return 'pending';
    case 'expire':
      return 'expired';
    case 'refund':
    case 'partial_refund':
      return 'refunded';
    case 'cancel':
    case 'deny':
    case 'failure':
      return 'failed';
    default:
      return 'pending';
  }
};

/** Buat (atau pakai ulang) tagihan QRIS untuk sebuah booking. */
export const createQrisPayment = async (bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true, customer: true, station: true },
  });
  if (!booking) throw notFound('Booking tidak ditemukan');
  if (!['pending', 'confirmed'].includes(booking.status)) throw badRequest('Booking ini tidak bisa dibayar');
  if (booking.payment?.status === 'paid') throw badRequest('Booking sudah dibayar');
  if (booking.totalPrice <= 0) throw badRequest('Total booking Rp0, tidak perlu pembayaran');

  // QR yang masih berlaku dipakai ulang agar pelanggan tidak mendapat QR berbeda.
  if (
    booking.payment &&
    booking.payment.method === 'qris' &&
    booking.payment.status === 'pending' &&
    booking.payment.qrUrl &&
    booking.payment.expiredAt &&
    booking.payment.expiredAt > new Date()
  ) {
    return booking.payment;
  }

  const setting = await getStoreSetting();
  const expiryMins = Math.max(5, setting.pendingExpiryMins);
  const orderId = `${booking.bookingCode ?? booking.id}-${Date.now().toString(36).toUpperCase()}`;

  const charge = await getCore().charge({
    payment_type: 'qris',
    transaction_details: { order_id: orderId, gross_amount: booking.totalPrice },
    qris: { acquirer: 'gopay' },
    item_details: [
      {
        id: booking.stationId,
        price: booking.totalPrice,
        quantity: 1,
        name: `${booking.station.name} ${booking.durationHours} jam`.slice(0, 50),
      },
    ],
    customer_details: { first_name: booking.customer.name, phone: booking.customer.whatsapp },
    custom_expiry: { expiry_duration: expiryMins, unit: 'minute' },
  });

  const qrUrl: string | undefined = charge?.actions?.find((a: any) => a.name === 'generate-qr-code')?.url;
  const data = {
    provider: 'midtrans',
    method: 'qris',
    amount: booking.totalPrice,
    status: mapStatus(charge.transaction_status, charge.fraud_status),
    transactionId: orderId,
    qrUrl: qrUrl ?? charge.qr_string ?? null,
    rawResponse: charge,
    expiredAt: addMinutes(new Date(), expiryMins),
  };

  return prisma.payment.upsert({
    where: { bookingId },
    create: { bookingId, ...data },
    update: { ...data, paidAt: null },
  });
};

/** Tandai pembayaran sebagai lunas lalu konfirmasi booking. */
const markPaid = async (paymentId: string, extra: { method?: string; raw?: unknown; actorId?: string } = {}) => {
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'paid',
      paidAt: new Date(),
      ...(extra.method ? { method: extra.method } : {}),
      ...(extra.raw ? { rawResponse: extra.raw as any } : {}),
    },
    include: { booking: { include: { customer: true } } },
  });

  if (payment.booking.status === 'pending') {
    await updateBookingStatus(payment.bookingId, 'confirmed', { actor: 'system', actorId: extra.actorId });
  }
  await notifyAdmins(
    'payment_paid',
    `Pembayaran diterima — ${payment.booking.bookingCode}`,
    `${payment.booking.customer.name} membayar Rp${payment.amount.toLocaleString('id-ID')} via ${payment.method.toUpperCase()}`,
    `/dashboard/bookings/${payment.bookingId}`,
  );
  return payment;
};

/** Verifikasi signature notifikasi Midtrans: sha512(order_id + status_code + gross_amount + server_key). */
const verifySignature = (body: any) => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  const expected = crypto
    .createHash('sha512')
    .update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`)
    .digest('hex');
  const given = String(body.signature_key || '');
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
};

export const handleMidtransNotification = async (body: any) => {
  if (!body?.order_id) throw badRequest('Payload notifikasi tidak valid');
  if (!verifySignature(body)) throw new HttpError(403, 'Signature Midtrans tidak valid');

  const payment = await prisma.payment.findUnique({ where: { transactionId: String(body.order_id) } });
  if (!payment) return { ignored: true, reason: 'order_id tidak dikenal' };

  const status = mapStatus(body.transaction_status, body.fraud_status);
  if (payment.status === 'paid' && status !== 'refunded') return { ok: true, status: payment.status };

  if (status === 'paid') {
    await markPaid(payment.id, { raw: body });
  } else {
    await prisma.payment.update({ where: { id: payment.id }, data: { status, rawResponse: body } });
  }
  return { ok: true, status };
};

/** Cek status terbaru (sinkron ke Midtrans jika masih pending). */
export const getPaymentStatus = async (bookingId: string) => {
  const payment = await prisma.payment.findUnique({ where: { bookingId } });
  if (!payment) throw notFound('Belum ada pembayaran untuk booking ini');

  if (payment.status === 'pending' && payment.provider === 'midtrans' && payment.transactionId && process.env.MIDTRANS_SERVER_KEY) {
    try {
      const res: any = await (getCore() as any).transaction.status(payment.transactionId);
      const status = mapStatus(res.transaction_status, res.fraud_status);
      if (status === 'paid') return markPaid(payment.id, { raw: res });
      if (status !== payment.status) {
        return prisma.payment.update({ where: { id: payment.id }, data: { status, rawResponse: res } });
      }
    } catch (e: any) {
      // 404 dari Midtrans = transaksi belum tercatat; abaikan.
      if (e?.httpStatusCode !== 404 && e?.httpStatusCode !== '404') console.error('Gagal cek status Midtrans:', e?.message);
    }
  }
  return payment;
};

/** Admin mencatat pembayaran tunai / transfer manual. */
export const recordManualPayment = async (bookingId: string, method: 'cash' | 'transfer', adminId?: string) => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true } });
  if (!booking) throw notFound('Booking tidak ditemukan');
  if (['cancelled', 'no_show'].includes(booking.status)) throw badRequest('Booking sudah dibatalkan');
  if (booking.payment?.status === 'paid') throw badRequest('Booking sudah dibayar');

  const payment = await prisma.payment.upsert({
    where: { bookingId },
    create: { bookingId, provider: 'manual', method, amount: booking.totalPrice, status: 'pending' },
    update: { provider: 'manual', method, amount: booking.totalPrice },
  });
  const paid = await markPaid(payment.id, { method, actorId: adminId });
  await logActivity('payment.manual', 'Payment', paid.id, { method, amount: paid.amount }, adminId);
  return paid;
};

export const refundPayment = async (bookingId: string, adminId?: string) => {
  const payment = await prisma.payment.findUnique({ where: { bookingId } });
  if (!payment) throw notFound('Pembayaran tidak ditemukan');
  if (payment.status !== 'paid') throw badRequest('Hanya pembayaran lunas yang bisa direfund');
  // Refund QRIS Midtrans dilakukan manual lewat dashboard Midtrans; di sini hanya pencatatan.
  const updated = await prisma.payment.update({ where: { id: payment.id }, data: { status: 'refunded' } });
  await logActivity('payment.refund', 'Payment', payment.id, { amount: payment.amount }, adminId);
  return updated;
};

/** Tandai pembayaran QRIS yang lewat masa berlaku. */
export const expireStalePayments = async () => {
  const { count } = await prisma.payment.updateMany({
    where: { status: 'pending', expiredAt: { lt: new Date() } },
    data: { status: 'expired' },
  });
  return count;
};
