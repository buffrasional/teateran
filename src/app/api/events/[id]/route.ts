import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Separate queries — NO include (crashes Next.js 16)
    const event = await db.event.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const priceCategories = await db.priceCategory.findMany({ where: { eventId: id } })
    const seats = await db.seat.findMany({ where: { eventId: id }, select: { status: true } })
    const showDates = await db.eventShowDate.findMany({
      where: { eventId: id },
      orderBy: { date: 'asc' },
    })

    const totalSeats = seats.length
    const availableSeats = seats.filter((s) => s.status === 'AVAILABLE').length
    const soldSeats = seats.filter((s) => s.status === 'SOLD').length

    // Fetch seat map layout if event has one
    let seatMapLayout: any = null
    if (event.seatMapId) {
      const seatMap = await db.seatMap.findUnique({
        where: { id: event.seatMapId },
        select: { layoutData: true },
      })
      if (seatMap) {
        seatMapLayout = seatMap.layoutData
      }
    }

    return NextResponse.json({
      ...event,
      priceCategories,
      showDates,
      seatSummary: {
        total: totalSeats,
        available: availableSeats,
        sold: soldSeats,
      },
      seatMapLayout,
    })
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}
