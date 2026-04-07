import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const published = searchParams.get('published')

    const where: Record<string, unknown> = {}

    if (category) {
      where.category = category
    }
    if (published !== null) {
      where.isPublished = published === 'true'
    }

    // Separate queries — NO include (crashes Next.js 16)
    const events = await db.event.findMany({
      where,
      orderBy: { showDate: 'asc' },
    })

    const eventIds = events.map((e) => e.id)
    const allPriceCategories = await db.priceCategory.findMany({ where: { eventId: { in: eventIds } } })
    const allSeats = await db.seat.findMany({ where: { eventId: { in: eventIds } }, select: { eventId: true, status: true } })
    const allShowDates = await db.eventShowDate.findMany({
      where: { eventId: { in: eventIds } },
      orderBy: { date: 'asc' },
    })

    const eventsWithSummary = events.map((event) => {
      const eventSeats = allSeats.filter((s) => s.eventId === event.id)
      const eventPriceCats = allPriceCategories.filter((pc) => pc.eventId === event.id)
      const eventShowDates = allShowDates.filter((sd) => sd.eventId === event.id)
      const totalSeats = eventSeats.length
      const availableSeats = eventSeats.filter((s) => s.status === 'AVAILABLE').length
      const soldSeats = eventSeats.filter((s) => s.status === 'SOLD').length

      return {
        id: event.id,
        title: event.title,
        category: event.category,
        showDate: event.showDate,
        openGate: event.openGate,
        location: event.location,
        posterUrl: event.posterUrl,
        synopsis: event.synopsis,
        isPublished: event.isPublished,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        priceCategories: eventPriceCats,
        showDates: eventShowDates,
        seatSummary: {
          total: totalSeats,
          available: availableSeats,
          sold: soldSeats,
        },
      }
    })

    return NextResponse.json({ events: eventsWithSummary })
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}
