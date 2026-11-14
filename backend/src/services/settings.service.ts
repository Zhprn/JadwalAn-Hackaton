import prisma from '../lib/prisma';
import { cached, invalidate } from '../lib/cache';

export type StoreSettingData = Awaited<ReturnType<typeof getStoreSetting>>;

/** Ambil pengaturan rental (baris tunggal). Dibuat otomatis dengan nilai default jika belum ada. */
export const getStoreSetting = () =>
  cached('settings:store', 60_000, async () => {
    const existing = await prisma.storeSetting.findFirst({ orderBy: { createdAt: 'asc' } });
    return existing ?? prisma.storeSetting.create({ data: {} });
  });

export const invalidateSettings = () => invalidate('settings:');

/** Daftar station aktif (dipakai berulang oleh booking & AI). */
export const getActiveStations = () =>
  cached('stations:active', 30_000, () =>
    prisma.station.findMany({ where: { status: 'active' }, orderBy: { sortOrder: 'asc' } }),
  );

export const invalidateStations = () => invalidate('stations:');
