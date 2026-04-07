import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
    }

    const merchandise = await db.merchandise.findMany({
      where: {
        eventId,
        stock: { gt: 0 }, // Only show items with stock
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        imageUrl: true,
      },
    })

    return NextResponse.json({ merchandise })
  } catch (error) {
    console.error('Error fetching merchandise:', error)
    return NextResponse.json(
      { error: 'Failed to fetch merchandise' },
      { status: 500 }
    )
  }
}
