import { db } from '@/lib/db'

export async function cleanupExpiredLocks() {
  const now = new Date()

  const result = await db.seat.updateMany({
    where: {
      status: 'LOCKED_TEMPORARY',
      lockedUntil: {
        lt: now,
      },
    },
    data: {
      status: 'AVAILABLE',
      lockedUntil: null,
      lockedBy: null,
    },
  })

  return result
}
