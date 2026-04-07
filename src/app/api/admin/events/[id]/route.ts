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
    const seats = await db.seat.findMany({ where: { eventId: id } })
    const transactions = await db.transaction.findMany({
      where: { eventId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const showDates = await db.eventShowDate.findMany({
      where: { eventId: id },
      orderBy: { date: 'asc' },
    })

    // Attach priceCategory to each seat
    const seatsWithCat = seats.map((seat) => {
      const cat = priceCategories.find((pc) => pc.id === seat.priceCategoryId) || null
      return { ...seat, priceCategory: cat }
    })

    return NextResponse.json({
      event: { ...event, priceCategories, seats: seatsWithCat, transactions, showDates },
    })
  } catch (error) {
    console.error('Error fetching admin event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const event = await db.event.findUnique({ where: { id } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Determine effective showDate (earliest from showDates, or provided showDate)
    let effectiveShowDate = showDate ? new Date(showDate) : event.showDate
    let effectiveOpenGate = openGate ? new Date(openGate) : event.openGate

    if (showDates && Array.isArray(showDates) && showDates.length > 0) {
      const sorted = [...showDates].sort(
        (a: { date: string }, b: { date: string }) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      effectiveShowDate = new Date(sorted[0].date)
      if (sorted[0].openGate) {
        effectiveOpenGate = new Date(sorted[0].openGate)
      }
    }

    await db.event.update({
      where: { id },
      data: {
        title: title ?? event.title,
        category: category ?? event.category,
        showDate: effectiveShowDate,
        openGate: effectiveOpenGate,
        location: location ?? event.location,
        posterUrl: posterUrl !== undefined ? posterUrl : event.posterUrl,
        teaserVideoUrl: teaserVideoUrl !== undefined ? teaserVideoUrl : event.teaserVideoUrl,
        synopsis: synopsis ?? event.synopsis,
        isPublished: isPublished !== undefined ? isPublished : event.isPublished,
        adminFee: adminFee !== undefined ? adminFee : event.adminFee,
      },
    })

    // Update price categories if provided - UPSERT strategy
    if (priceCategories && Array.isArray(priceCategories)) {
      const existingCats = await db.priceCategory.findMany({ where: { eventId: id } })
      const existingCatIds = new Set(existingCats.map((c) => c.id))
      const incomingCatIds = new Set(
        (priceCategories as Array<{ id?: string }>).filter((c) => c.id).map((c) => c.id!)
      )

      const toDeleteCats = existingCats.filter((c) => !incomingCatIds.has(c.id))
      if (toDeleteCats.length > 0) {
        await db.priceCategory.deleteMany({
          where: { id: { in: toDeleteCats.map((c) => c.id) } },
        })
      }

      for (const pc of priceCategories as Array<{ id?: string; name: string; price: number; colorCode: string }>) {
        if (pc.id && existingCatIds.has(pc.id)) {
          await db.priceCategory.update({
            where: { id: pc.id },
            data: { name: pc.name, price: pc.price, colorCode: pc.colorCode },
          })
        } else {
          await db.priceCategory.create({
            data: { eventId: id, name: pc.name, price: pc.price, colorCode: pc.colorCode },
          })
        }
      }
    }

    // Update show dates if provided — UPSERT strategy (never cascade-delete existing seats!)
    // 1. Fetch existing show dates
    const existingShowDates = await db.eventShowDate.findMany({ where: { eventId: id } })
    const existingIds = new Set(existingShowDates.map((sd) => sd.id))
    const incomingIds = new Set(
      (showDates as Array<{ id?: string; date: string; openGate?: string; label?: string }>)
        ?.filter((sd) => sd.id)
        .map((sd) => sd.id!)
    )

    // 2. Delete only removed show dates (ones that exist in DB but not in incoming)
    const toDelete = existingShowDates.filter((sd) => !incomingIds.has(sd.id))
    for (const sd of toDelete) {
      // Check if this show date has sold seats — prevent deletion if so
      const soldCount = await db.seat.count({
        where: { eventShowDateId: sd.id, status: 'SOLD' },
      })
      if (soldCount > 0) {
        return NextResponse.json({
          error: `Tidak bisa menghapus tanggal "${sd.label || new Date(sd.date).toLocaleDateString('id-ID')}". Masih ada ${soldCount} kursi terjual.`,
        }, { status: 409 })
      }
    }
    if (toDelete.length > 0) {
      await db.eventShowDate.deleteMany({
        where: { id: { in: toDelete.map((sd) => sd.id) } },
      })
    }

    // 3. Update existing + create new
    if (showDates && Array.isArray(showDates) && showDates.length > 0) {
      for (const sd of showDates as Array<{ id?: string; date: string; openGate?: string; label?: string }>) {
        if (sd.id && existingIds.has(sd.id)) {
          // Update existing
          await db.eventShowDate.update({
            where: { id: sd.id },
            data: {
              date: new Date(sd.date),
              openGate: sd.openGate ? new Date(sd.openGate) : null,
              label: sd.label || null,
            },
          })
        } else {
          // Create new
          await db.eventShowDate.create({
            data: {
              eventId: id,
              date: new Date(sd.date),
              openGate: sd.openGate ? new Date(sd.openGate) : null,
              label: sd.label || null,
            },
          })
        }
      }
    }

    // Re-fetch separately — NO include
    const updatedEvent = await db.event.findUnique({ where: { id } })
    const updatedPriceCats = await db.priceCategory.findMany({ where: { eventId: id } })
    const updatedShowDates = await db.eventShowDate.findMany({
      where: { eventId: id },
      orderBy: { date: 'asc' },
    })

    return NextResponse.json({
      event: { ...updatedEvent, priceCategories: updatedPriceCats, showDates: updatedShowDates },
    })
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

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

    await db.transaction.deleteMany({ where: { eventId: id } })
    await db.seat.deleteMany({ where: { eventId: id } })
    await db.priceCategory.deleteMany({ where: { eventId: id } })
    await db.eventShowDate.deleteMany({ where: { eventId: id } })
    await db.event.delete({ where: { id } })

    return NextResponse.json({ message: 'Event deleted successfully' })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}
