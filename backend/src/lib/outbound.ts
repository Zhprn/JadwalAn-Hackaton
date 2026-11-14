/**
 * Jembatan pengiriman pesan keluar (mencegah circular import antara chat/booking service
 * dan whatsapp.service). whatsapp.service mendaftarkan fungsinya saat dimuat.
 */
export type WhatsAppSender = (phone: string, text: string) => Promise<void>;

export const outbound: {
  whatsapp: WhatsAppSender | null;
  isWhatsAppReady: () => boolean;
} = {
  whatsapp: null,
  isWhatsAppReady: () => false,
};
