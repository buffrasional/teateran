/**
 * Seed / Update script for "Auditorium Rendra" seat map.
 * Creates the correct 142-seat layout with embedded A/B rows.
 * Run: npx tsx scripts/seed-auditorium.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('=== Seeding Auditorium Rendra Seat Map ===')

  // 1. Push schema changes (isTemplate field)
  console.log('Checking schema...')

  // 2. Delete existing Auditorium seat maps
  const existing = await db.seatMap.findMany({
    where: { name: { contains: 'Auditorium' } },
  })
  if (existing.length > 0) {
    console.log(`Deleting ${existing.length} existing Auditorium seat map(s)...`)
    // Delete locks first
    for (const sm of existing) {
      await db.mapEditorLock.deleteMany({ where: { seatMapId: sm.id } })
    }
    // Delete seat maps
    await db.seatMap.deleteMany({
      where: { name: { contains: 'Auditorium' } },
    })
    console.log('Deleted.')
  }

  // 3. Build the 142-seat layout
  const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']
  const COLS = 20

  const config: Array<{ left: number; right: number }> = [
    { left: 0, right: 0 }, // A
    { left: 0, right: 0 }, // B
    { left: 4, right: 4 }, // C
    { left: 4, right: 4 }, // D
    { left: 5, right: 5 }, // E
    { left: 6, right: 6 }, // F
    { left: 6, right: 6 }, // G
    { left: 6, right: 6 }, // H
    { left: 6, right: 6 }, // I
    { left: 8, right: 8 }, // J
    { left: 8, right: 8 }, // K
    { left: 8, right: 8 }, // L
    { left: 8, right: 8 }, // M
  ]

  const seats: { r: number; c: number; block: string }[] = []

  // Row A (index 0): 2 center seats
  const centerStart = Math.floor((COLS - 2) / 2)
  seats.push({ r: 0, c: centerStart, block: 'center' })
  seats.push({ r: 0, c: centerStart + 1, block: 'center' })

  // Row B (index 1): 2 center seats
  seats.push({ r: 1, c: centerStart, block: 'center' })
  seats.push({ r: 1, c: centerStart + 1, block: 'center' })

  // Rows C through M: left + right blocks
  for (let ri = 2; ri < config.length; ri++) {
    const { left, right } = config[ri]
    for (let i = 0; i < left; i++) {
      seats.push({ r: ri, c: i, block: 'left' })
    }
    for (let i = 0; i < right; i++) {
      seats.push({ r: ri, c: COLS - right + i, block: 'right' })
    }
  }

  const layoutData = {
    type: 'NUMBERED',
    gridSize: { rows: 13, cols: COLS },
    aisleColumns: [],
    rowLabels,
    seats,
    embeddedRows: {
      '0': 2,  // A → C
      '1': 3,  // B → D
    },
    sections: [
      { name: 'VIP', fromRow: 0, toRow: 3, colorCode: '#C8A951' },
      { name: 'Regular', fromRow: 4, toRow: 7, colorCode: '#8B8680' },
      { name: 'Student', fromRow: 8, toRow: 12, colorCode: '#7BA7A5' },
    ],
  }

  console.log(`Total seats in layout: ${seats.length}`)
  if (seats.length !== 142) {
    throw new Error(`Expected 142 seats but generated ${seats.length}`)
  }

  // 4. Create the seat map
  const seatMap = await db.seatMap.create({
    data: {
      name: 'Auditorium Rendra',
      creatorName: 'System',
      seatType: 'NUMBERED',
      layoutData: layoutData as any,
      isTemplate: true,
    },
  })

  console.log(`Created seat map: ${seatMap.id}`)
  console.log(`Name: ${seatMap.name}`)
  console.log(`Seats: ${seats.length}`)
  console.log(`isTemplate: ${seatMap.isTemplate}`)
  console.log('=== Done ===')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
