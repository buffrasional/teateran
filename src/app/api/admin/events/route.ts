import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Separate queries — NO include
    const events = await db.event.findMany({
      orderBy: { createdAt: 'desc' },
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
        ...event,
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
    console.error('Error fetching admin events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      category,
      showDate,
      openGate,
      location,
      posterUrl,
      synopsis,
      isPublished,
      adminFee,
      priceCategories,
      showDates,
      teaserVideoUrl,
    } = body

    if (!title || !showDate || !location || !synopsis) {
      return NextResponse.json(
        { error: 'title, showDate, location, and synopsis are required' },
        { status: 400 }
      )
    }

    // Determine the effective showDate (earliest from showDates, or provided showDate)
    let effectiveShowDate = new Date(showDate)
    let effectiveOpenGate = openGate ? new Date(openGate) : null

    if (showDates && Array.isArray(showDates) && showDates.length > 0) {
      // Sort by date to find earliest
      const sorted = [...showDates].sort(
        (a: { date: string }, b: { date: string }) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      effectiveShowDate = new Date(sorted[0].date)
      // Use openGate from earliest show date if available
      if (sorted[0].openGate) {
        effectiveOpenGate = new Date(sorted[0].openGate)
      }
    }

    // Create event first, then create price categories and show dates separately — NO include in create
    const event = await db.event.create({
      data: {
        title,
        category: category || 'Teater',
        showDate: effectiveShowDate,
        openGate: effectiveOpenGate,
        location,
        posterUrl: posterUrl || null,
        teaserVideoUrl: teaserVideoUrl || null,
        synopsis,
        isPublished: isPublished || false,
        adminFee: adminFee || 0,
      },
    })

    if (priceCategories && Array.isArray(priceCategories)) {
      await db.priceCategory.createMany({
        data: priceCategories.map(
          (pc: { name: string; price: number; colorCode: string }) => ({
            eventId: event.id,
            name: pc.name,
            price: pc.price,
            colorCode: pc.colorCode,
          })
        ),
      })
    }

    // Create EventShowDate records
    if (showDates && Array.isArray(showDates) && showDates.length > 0) {
      await db.eventShowDate.createMany({
        data: showDates.map((sd: { date: string; openGate?: string; label?: string }) => ({
          eventId: event.id,
          date: new Date(sd.date),
          openGate: sd.openGate ? new Date(sd.openGate) : null,
          label: sd.label || null,
        })),
      })
    }

    const createdPriceCats = await db.priceCategory.findMany({ where: { eventId: event.id } })
    const createdShowDates = await db.eventShowDate.findMany({
      where: { eventId: event.id },
      orderBy: { date: 'asc' },
    })

    return NextResponse.json({
      event: { ...event, priceCategories: createdPriceCats, showDates: createdShowDates },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}
