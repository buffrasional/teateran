import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { seats, showDateId } = body

    if (!seats || !Array.isArray(seats) || seats.length === 0) {
      return NextResponse.json({ error: 'seats array is required' }, { status: 400 })
    }

    const event = await db.event.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Process each seat — group by (status + priceCategoryId) for bulk updates
    const key = (s: Record<string, unknown>) =>
      `${s.status}|${s.priceCategoryId ?? 'null'}`
    const groups: Record<string, typeof seats> = {}
    for (const seat of seats) {
      const k = key(seat)
      if (!groups[k]) groups[k] = []
      groups[k].push(seat)
    }

    for (const group of Object.values(groups)) {
      const codes = group.map((s: { seatCode: string }) => s.seatCode)
      const sample = group[0] as Record<string, unknown>
      const data: Record<string, unknown> = { status: sample.status }
      if (sample.status !== 'LOCKED_TEMPORARY') data.lockedUntil = null
      if (sample.priceCategoryId !== undefined && sample.priceCategoryId !== null) {
        data.priceCategoryId = sample.priceCategoryId
      }
      // CRITICAL: Filter by showDateId to prevent cross-day data corruption
      const whereClause: any = { eventId: id, seatCode: { in: codes } }
      if (showDateId) whereClause.eventShowDateId = showDateId
      await db.seat.updateMany({
        where: whereClause,
        data,
      })
    }

    return NextResponse.json({ message: 'Seats updated successfully', updatedCount: seats.length })
  } catch (error) {
    console.error('Error updating seats:', error)
    return NextResponse.json({ error: 'Failed to update seats' }, { status: 500 })
  }
}

// ─── DELETE: Clear all seats for an event (for regeneration) ────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const event = await db.event.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check for existing sold/locked seats that shouldn't be deleted
    const activeSeats = await db.seat.count({
      where: {
        eventId: id,
        status: { in: ['SOLD', 'LOCKED_TEMPORARY'] },
      },
    })

    if (activeSeats > 0) {
      return NextResponse.json(
        { error: `Tidak bisa menghapus kursi. Masih ada ${activeSeats} kursi yang sudah terjual/terkunci.` },
        { status: 409 }
      )
    }

    // Delete all seats
    const result = await db.seat.deleteMany({ where: { eventId: id } })

    // Unlink seat map from event
    await db.event.update({
      where: { id },
      data: { seatMapId: null },
    })

    return NextResponse.json({
      message: `${result.count} kursi berhasil dihapus. Event siap untuk regenerate.`,
      deletedCount: result.count,
    })
  } catch (error) {
    console.error('Error deleting seats:', error)
    return NextResponse.json({ error: 'Failed to delete seats' }, { status: 500 })
  }
}
