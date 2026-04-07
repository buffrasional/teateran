import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ─── Helper: determine category from sections ─────────────────────────────

function getCategoryForRow(rowIdx: number, sections: any[]): string | null {
  if (!sections || !Array.isArray(sections)) return null
  for (const section of sections) {
    const from = section.fromRow ?? section.from ?? 0
    const to = section.toRow ?? section.to ?? 999
    if (rowIdx >= from && rowIdx <= to) return section.name
  }
  return null
}

// ─── Helper: parse layoutData and generate seat records ────────────────────

function generateSeatsFromLayout(
  layoutData: any,
  eventId: string,
  priceCategoryMap: Record<string, string>
): { seatCode: string; status: string; row: string; col: number; priceCategoryId: string | null; zoneName: string | null }[] {
  const seats: any[] = []

  if (!layoutData) return seats

  const data = typeof layoutData === 'string' ? JSON.parse(layoutData) : layoutData

  if (data.type === 'NUMBERED') {
    // ─── NUMBERED: parse from seat map builder format ───────────────
    const rawSeats = data.seats || []
    const sections = data.sections || []
    const aisleColumns = data.aisleColumns || []

    // Sort seats by row index then col index for proper numbering
    const sorted = [...rawSeats].sort((a: any, b: any) => {
      const rDiff = (a.r ?? a.row ?? 0) - (b.r ?? b.row ?? 0)
      if (rDiff !== 0) return rDiff
      return (a.c ?? a.col ?? 0) - (b.c ?? b.col ?? 0)
    })

    // Group by row and compute column numbers (skip aisles)
    const rowGroups: Record<number, any[]> = {}
    for (const seat of sorted) {
      const rowIdx = seat.r ?? seat.row ?? 0
      if (!rowGroups[rowIdx]) rowGroups[rowIdx] = []
      rowGroups[rowIdx].push(seat)
    }

    for (const [rowIdx, rowSeats] of Object.entries(rowGroups) as [string, any[]][]) {
      const ri = parseInt(rowIdx)
      const rowLabel = data.rowLabels?.[ri] || String.fromCharCode(65 + ri)
      const category = getCategoryForRow(ri, sections)
      const priceCatId = category && priceCategoryMap[category] ? priceCategoryMap[category] : null

      // Seats are already sorted by column (c) within the row.
      // Just assign sequential seat numbers 1, 2, 3, ... per row.
      let colNum = 1
      for (const seat of rowSeats) {
        seats.push({
          seatCode: `${rowLabel}-${colNum}`,
          status: 'AVAILABLE',
          row: rowLabel,
          col: colNum,
          priceCategoryId: priceCatId,
          zoneName: null,
        })
        colNum++
      }
    }
  } else if (data.type === 'GENERAL_ADMISSION' && data.zones && Array.isArray(data.zones)) {
    // ─── GA zones ───────────────────────────────────────────────────
    for (const zone of data.zones) {
      const capacity = zone.capacity || 0
      const zoneName = zone.name || 'GA'
      const category = zone.category || null
      const priceCatId = category && priceCategoryMap[category] ? priceCategoryMap[category] : null

      // Skip stage/panggung zones (capacity 0)
      if (capacity <= 0) continue

      for (let i = 1; i <= capacity; i++) {
        seats.push({
          seatCode: `${zoneName}-${i}`,
          status: 'AVAILABLE',
          row: zoneName,
          col: i,
          priceCategoryId: priceCatId,
          zoneName,
        })
      }
    }
  } else if (Array.isArray(data) && data.length > 0) {
    // ─── Legacy format ──────────────────────────────────────────────
    for (const seat of data) {
      seats.push({
        seatCode: `${seat.row}-${seat.col}`,
        status: 'AVAILABLE',
        row: seat.row,
        col: seat.col,
        priceCategoryId: seat.category && priceCategoryMap[seat.category] ? priceCategoryMap[seat.category] : null,
        zoneName: seat.zoneName || null,
      })
    }
  }

  return seats
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { seatMapId } = body

    const event = await db.event.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // ─── Clean up existing seats if any (safety net) ────────────────────
    await db.seat.deleteMany({ where: { eventId: id } })

    // ─── Must provide a seatMapId ──────────────────────────────────────
    if (!seatMapId) {
      return NextResponse.json(
        { error: 'Pilih Seat Map terlebih dahulu.' },
        { status: 400 }
      )
    }

    // Fetch the seat map
    const seatMap = await db.seatMap.findUnique({ where: { id: seatMapId } })
    if (!seatMap) {
      return NextResponse.json({ error: 'Seat Map tidak ditemukan' }, { status: 404 })
    }

    // Get price categories for this event
    const priceCategories = await db.priceCategory.findMany({ where: { eventId: id } })
    const priceCategoryMap: Record<string, string> = {}
    for (const pc of priceCategories) {
      priceCategoryMap[pc.name] = pc.id
    }

    // Get show dates for this event
    const showDates = await db.eventShowDate.findMany({
      where: { eventId: id },
      orderBy: { date: 'asc' },
    })

    // Generate seats from seat map layout (base seat records)
    const seatData = generateSeatsFromLayout(seatMap.layoutData, id, priceCategoryMap)

    if (seatData.length === 0) {
      return NextResponse.json(
        { error: 'Seat Map kosong atau format tidak dikenali. Edit seat map dan tambahkan kursi terlebih dahulu.' },
        { status: 400 }
      )
    }

    // ─── Multi-day: duplicate seats per show date ─────────────────────
    // If event has multiple show dates, create separate seat inventories per date.
    // If event has only 1 show date (or none), create seats without showDateId (backward compat).
    let totalCreated = 0

    if (showDates.length > 1) {
      // Multi-day event: create seats for EACH show date
      for (const sd of showDates) {
        const result = await db.seat.createMany({
          data: seatData.map((s) => ({
            eventId: id,
            eventShowDateId: sd.id,
            seatCode: s.seatCode,
            status: s.status,
            row: s.row,
            col: s.col,
            priceCategoryId: s.priceCategoryId,
            zoneName: s.zoneName,
          })),
        })
        totalCreated += result.count
      }
    } else {
      // Single-day event: create seats without showDateId
      const result = await db.seat.createMany({
        data: seatData.map((s) => ({
          eventId: id,
          eventShowDateId: showDates.length === 1 ? showDates[0].id : null,
          seatCode: s.seatCode,
          status: s.status,
          row: s.row,
          col: s.col,
          priceCategoryId: s.priceCategoryId,
          zoneName: s.zoneName,
        })),
      })
      totalCreated = result.count
    }

    // Link event to seat map
    await db.event.update({
      where: { id },
      data: { seatMapId },
    })

    const perDayLabel = showDates.length > 1
      ? ` (${showDates.length} hari × ${seatData.length} kursi/hari)`
      : ''

    return NextResponse.json({
      message: `${totalCreated} kursi berhasil di-generate dari Seat Map "${seatMap.name}"${perDayLabel}`,
      totalSeats: totalCreated,
      seatsPerDay: seatData.length,
      showDatesCount: showDates.length,
      seatMapName: seatMap.name,
      seatMapType: seatMap.seatType,
    })
  } catch (error) {
    console.error('Error generating seats:', error)
    return NextResponse.json({ error: 'Failed to generate seats' }, { status: 500 })
  }
}
