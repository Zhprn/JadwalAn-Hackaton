import prisma from './prisma';

export type NotifType = 'new_chat' | 'new_booking' | 'handoff' | 'payment_paid' | 'booking_cancelled';

/** Catat aktivitas admin/sistem. Tidak pernah melempar error agar request utama tidak gagal. */
export const logActivity = async (
  action: string,
  entity: string,
  entityId?: string | null,
  changes?: unknown,
  userId?: string | null,
) => {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        entity,
        entityId: entityId ?? null,
        changes: changes === undefined ? undefined : JSON.parse(JSON.stringify(changes)),
        userId: userId ?? null,
      },
    });
  } catch (e) {
    console.error('Gagal mencatat activity log:', e);
  }
};

/** Kirim notifikasi ke admin (userId null = untuk semua admin). */
export const notifyAdmins = async (
  type: NotifType,
  title: string,
  body?: string,
  link?: string,
  userId?: string | null,
) => {
  try {
    await prisma.notification.create({ data: { type, title, body, link, userId: userId ?? null } });
  } catch (e) {
    console.error('Gagal membuat notifikasi:', e);
  }
};
