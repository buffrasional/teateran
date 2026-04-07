import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const seatMaps = await db.seatMap.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Count events using each map (separate query — NO include)
    const seatMapIds = seatMaps.map((sm) => sm.id)
    const eventsUsingMaps = await db.event.findMany({
      where: { seatMapId: { in: seatMapIds } },
      select: { seatMapId: true, id: true },
    })

    const seatMapsWithCount = seatMaps.map((sm) => {
      const eventCount = eventsUsingMaps.filter((e) => e.seatMapId === sm.id).length
      return { ...sm, _count: { events: eventCount } }
    })

    return NextResponse.json({ seatMaps: seatMapsWithCount })
  } catch (error) {
    console.error('Error fetching seat maps:', error)
    return NextResponse.json(
      { error: 'Failed to fetch seat maps' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, creatorName, seatType, layoutData } = body

    if (!name || !creatorName) {
      return NextResponse.json(
        { error: 'name and creatorName are required' },
        { status: 400 }
      )
    }

    if (seatType && seatType !== 'NUMBERED' && seatType !== 'GENERAL_ADMISSION') {
      return NextResponse.json(
        { error: 'seatType must be NUMBERED or GENERAL_ADMISSION' },
        { status: 400 }
      )
    }

    const seatMap = await db.seatMap.create({
      data: {
        name,
        creatorName,
        seatType: seatType || 'NUMBERED',
        layoutData: layoutData !== undefined ? layoutData : [],
      },
    })

    return NextResponse.json({ seatMap }, { status: 201 })
  } catch (error) {
    console.error('Error creating seat map:', error)
    return NextResponse.json(
      { error: 'Failed to create seat map' },
      { status: 500 }
    )
  }
}
