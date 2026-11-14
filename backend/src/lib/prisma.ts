import { PrismaClient } from '@prisma/client';

// Satu PrismaClient untuk seluruh aplikasi, supaya koneksi ke pooler Supabase tidak membengkak.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
