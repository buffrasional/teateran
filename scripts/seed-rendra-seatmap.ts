/**
 * Seed script: Create "Auditorium Rendra" seat map with exact 142-seat blueprint.
 * Deletes any existing version first.
 * Run: npx tsx scripts/seed-rendra-seatmap.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.lpdujkpjkcpyiptzyeml:SXcu1zaz1sYqki3R@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
    },
  },
})

async function main() {
  console.log('Deleting existing Rendra seat maps...')

  const deleted = await db.seatMap.deleteMany({
    where: {
      OR: [
        { name: 'Auditorium Rendra' },
        { name: 'Stage Teater Rendra' },
      ],
    },
  })
  console.log(`   Deleted ${deleted.count} old seat map(s)`)

  // ═══════════════════════════════════════════════════════════
  // Build the exact 142-seat layout — same logic as template
  // ═══════════════════════════════════════════════════════════
  const rowLabels = ['A','B','C','D','E','F','G','H','I','J','K','L','M']
  const COLS = 20
  const rows = 13

  const config = [
    { left: 0, right: 0, center: 2 }, // A
    { left: 0, right: 0, center: 2 }, // B
    { left: 4, right: 4 },            // C
    { left: 4, right: 4 },            // D
    { left: 5, right: 5 },            // E
    { left: 6, right: 6 },            // F
    { left: 6, right: 6 },            // G
    { left: 6, right: 6 },            // H
    { left: 6, right: 6 },            // I
    { left: 8, right: 8 },            // J
    { left: 8, right: 8 },            // K
    { left: 8, right: 8 },            // L
    { left: 8, right: 8 },            // M
  ]

  const seats: { r: number; c: number; block: string }[] = []

  for (let ri = 0; ri < config.length; ri++) {
    const { left, right, center } = config[ri]

    if (center) {
      const centerStart = Math.floor((COLS - center) / 2)
      for (let i = 0; i < center; i++) {
        seats.push({ r: ri, c: centerStart + i, block: 'center' })
      }
    } else {
      for (let i = 0; i < left; i++) {
        seats.push({ r: ri, c: i, block: 'left' })
      }
      for (let i = 0; i < right; i++) {
        seats.push({ r: ri, c: COLS - right + i, block: 'right' })
      }
    }
  }

  const layoutData = {
    type: 'NUMBERED',
    gridSize: { rows, cols: COLS },
    aisleColumns: [] as number[],
    rowLabels,
    seats,
    sections: [
      { name: 'VIP',     fromRow: 0, toRow: 3,  colorCode: '#C8A951' },
      { name: 'Regular', fromRow: 4, toRow: 7,  colorCode: '#8B8680' },
      { name: 'Student', fromRow: 8, toRow: 12, colorCode: '#7BA7A5' },
    ],
  }

  console.log(`Total seats: ${seats.length}`)

  const expected = 2+2+8+8+10+12+12+12+12+16+16+16+16
  if (seats.length !== expected) {
    console.error(`EXPECTED ${expected} seats but got ${seats.length}!`)
    process.exit(1)
  }

  console.log('Creating "Auditorium Rendra" seat map...')
  const seatMap = await db.seatMap.create({
    data: {
      name: 'Auditorium Rendra',
      creatorName: 'System',
      seatType: 'NUMBERED',
      layoutData: layoutData as any,
    },
  })

  console.log(`Done! Seat map ID: ${seatMap.id}`)
  console.log(`  Name: ${seatMap.name}`)
  console.log(`  Seats: ${seats.length}`)
  console.log(`  Grid: ${COLS}x${rows}`)

  console.log('\nRow Summary:')
  const rowGroups: Record<number, number> = {}
  for (const s of seats) {
    rowGroups[s.r] = (rowGroups[s.r] || 0) + 1
  }
  for (let r = 0; r < rows; r++) {
    const count = rowGroups[r] || 0
    const label = rowLabels[r]
    const cfg = config[r]
    const desc = cfg.center ? `center x${count}` : `left ${cfg.left} + right ${cfg.right}`
    console.log(`  Row ${label}: ${count} seats (${desc})`)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
