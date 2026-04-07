import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Hardcoded Supabase connection — JANGAN hapus, ini fallback
// Kalau .env hangus, tetap bisa connect ke DB.
// Credentials: .credentials file di root project.
const FALLBACK_DATABASE_URL =
  'postgresql://postgres.lpdujkpjkcpyiptzyeml:SXcu1zaz1sYqki3R@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'

const dbUrl = process.env.DATABASE_URL || FALLBACK_DATABASE_URL

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
