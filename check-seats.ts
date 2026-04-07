import { db } from './src/lib/db'

async function check() {
  const seats = await db.seat.findMany({
    where: { status: 'LOCKED_TEMPORARY' },
    select: { seatCode: true, status: true, lockedBy: true, lockedUntil: true }
  })
  console.log("Current LOCKED_TEMPORARY seats:", seats)
}

check().catch(console.error).finally(async () => await db.$disconnect())
