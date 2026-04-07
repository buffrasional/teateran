import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/usher/seats-info?eventId=xxx
// Returns a map of seatCode -> transaction info for all SOLD/PAID seats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 }
      )
    }

    // Verify event exists
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Get all paid transactions for this event
    const transactions = await db.transaction.findMany({
      where: {
        eventId,
        paymentStatus: 'PAID',
      },
      select: {
        transactionId: true,
        customerName: true,
        customerEmail: true,
        customerWa: true,
        seatCodes: true,
        paymentStatus: true,
        checkInTime: true,
        paidAt: true,
        totalAmount: true,
        id: true,
      },
    })

    // Build seatCode -> transaction info map
    const seatInfoMap: Record<string, {
      owner: string
      email: string
      phone: string
      transactionId: string
      paymentStatus: string
      checkInTime: string | null
      paidAt: string | null
      totalAmount: number
    }> = {}

    for (const txn of transactions) {
      let seatCodes: string[] = []

      // Parse seatCodes JSON string
      try {
        seatCodes = JSON.parse(txn.seatCodes)
      } catch {
        // Fallback: try comma-separated
        seatCodes = txn.seatCodes.split(',').map((s: string) => s.trim()).filter(Boolean)
      }

      for (const code of seatCodes) {
        seatInfoMap[code] = {
          owner: txn.customerName,
          email: txn.customerEmail,
          phone: txn.customerWa,
          transactionId: txn.transactionId,
          paymentStatus: txn.paymentStatus,
          checkInTime: txn.checkInTime?.toISOString() || null,
          paidAt: txn.paidAt?.toISOString() || null,
          totalAmount: txn.totalAmount,
        }
      }
    }

    return NextResponse.json({
      event: { id: event.id, title: event.title },
      seats: seatInfoMap,
      totalSold: Object.keys(seatInfoMap).length,
    })
  } catch (error) {
    console.error('Error fetching usher seats info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch seats info' },
      { status: 500 }
    )
  }
}
