import { Request, Response } from 'express';
import { z } from 'zod';
import { badRequest } from '../lib/http';
import { logActivity } from '../lib/activity';
import { getWaConfig } from '../services/notify.service';
import {
  checkWhatsAppNumber,
  getWaStatus,
  isWaConnected,
  logoutWhatsApp,
  sendWhatsAppText,
  startWhatsApp,
  updateWaConfig,
} from '../services/whatsapp.service';
import { AuthRequest } from '../middlewares/authMiddleware';

/** GET /whatsapp/status — status koneksi + QR (di-polling dashboard saat menghubungkan). */
export const status = async (_req: AuthRequest, res: Response): Promise<any> => {
  res.json({ success: true, data: await getWaStatus() });
};

/** POST /whatsapp/connect — mulai koneksi; QR muncul di /status. */
export const connect = async (req: AuthRequest, res: Response): Promise<any> => {
  await startWhatsApp();
  await logActivity('whatsapp.connect', 'Channel', 'whatsapp', null, req.user?.id);
  res.json({ success: true, data: await getWaStatus() });
};

/** POST /whatsapp/logout — putuskan & hapus sesi perangkat. */
export const logout = async (req: AuthRequest, res: Response): Promise<any> => {
  await logoutWhatsApp(req.user?.id);
  res.json({ success: true, data: await getWaStatus() });
};

/** PUT /whatsapp/config — atur balas otomatis AI & notifikasi. */
export const config = async (req: AuthRequest, res: Response): Promise<any> => {
  const data = z
    .object({
      autoReply: z.boolean(),
      notifyBooking: z.boolean(),
      notifyReminder: z.boolean(),
      reminderMins: z.number().int().min(10).max(24 * 60),
    })
    .partial()
    .parse(req.body);
  res.json({ success: true, data: await updateWaConfig(data, req.user?.id) });
};

/** POST /whatsapp/test — kirim pesan uji. */
export const test = async (req: AuthRequest, res: Response): Promise<any> => {
  const { to, message } = z.object({ to: z.string().min(9), message: z.string().min(1).max(2000) }).parse(req.body);
  if (!(await checkWhatsAppNumber(to))) throw badRequest('Nomor tersebut tidak terdaftar di WhatsApp');
  await sendWhatsAppText(to, message);
  res.json({ success: true, message: 'Pesan uji terkirim' });
};

/** GET /whatsapp/public — info publik untuk aplikasi pelanggan (tombol "Chat via WhatsApp"). */
export const publicInfo = async (_req: Request, res: Response): Promise<any> => {
  const s = await getWaStatus();
  const cfg = await getWaConfig();
  res.json({ success: true, data: { connected: isWaConnected(), phone: isWaConnected() ? s.phone : null, aiReply: cfg.autoReply } });
};
