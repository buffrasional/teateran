import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const showDateId = searchParams.get('showDateId') || undefined

    const event = await db.event.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Separate queries — NO include (crashes Next.js 16)
    // Build where clause — filter by showDateId if provided
    // If no showDateId, return ALL seats for the event (used by admin/usher views)
    const seatWhere: any = { eventId: id }
    if (showDateId) {
      seatWhere.eventShowDateId = showDateId
    }

    const seats = await db.seat.findMany({
      where: seatWhere,
      select: {
        id: true,
        seatCode: true,
        status: true,
        row: true,
        col: true,
        lockedUntil: true,
        priceCategoryId: true,
        eventShowDateId: true,
      },
      orderBy: [{ row: 'asc' }, { col: 'asc' }],
    })

    const priceCategories = await db.priceCategory.findMany({
      where: { eventId: id },
      select: {
        id: true,
        name: true,
        price: true,
        colorCode: true,
      },
    })

    // Manually attach priceCategory to each seat
    const seatMap = seats.map((seat) => {
      const cat = priceCategories.find((pc) => pc.id === seat.priceCategoryId) || null
      // Sanitize expired temporary locks: if locked time has passed, treat as AVAILABLE
      const isExpired = seat.status === 'LOCKED_TEMPORARY' && seat.lockedUntil && new Date(seat.lockedUntil).getTime() < Date.now();
      const finalStatus = isExpired ? 'AVAILABLE' : seat.status;
      const finalLockedUntil = isExpired ? null : seat.lockedUntil;

      return {
        id: seat.id,
        seatCode: seat.seatCode,
        status: finalStatus,
        row: seat.row,
        col: seat.col,
        lockedUntil: finalLockedUntil,
        priceCategory: cat,
        eventShowDateId: seat.eventShowDateId,
      }
    })

    return NextResponse.json({ seats: seatMap, priceCategories })
  } catch (error) {
    console.error('Error fetching seats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch seats' },
      { status: 500 }
    )
  }
}
