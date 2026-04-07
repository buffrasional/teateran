import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
    }

    // Find all PAID transactions for this event that have merchandise
    const transactions = await db.transaction.findMany({
      where: {
        eventId,
        paymentStatus: 'PAID',
        merchandiseData: { not: null },
      },
      select: {
        transactionId: true,
        customerName: true,
        customerEmail: true,
        customerWa: true,
        seatCodes: true,
        merchandiseData: true,
        totalAmount: true,
        paymentStatus: true,
        paidAt: true,
        checkInTime: true,
      },
      orderBy: { paidAt: 'desc' },
    })

    const orders = transactions.map((trx) => {
      let merchItems: any[] = []
      try {
        merchItems = JSON.parse(trx.merchandiseData || '[]')
      } catch {
        // ignore parse errors
      }

      let seatCodes: string[] = []
      try {
        seatCodes = JSON.parse(trx.seatCodes || '[]')
      } catch {
        // ignore
      }

      return {
        transactionId: trx.transactionId,
        customerName: trx.customerName,
        customerEmail: trx.customerEmail,
        customerWa: trx.customerWa,
        seatCodes,
        merchItems,
        totalAmount: trx.totalAmount,
        paymentStatus: trx.paymentStatus,
        paidAt: trx.paidAt,
        checkInTime: trx.checkInTime,
      }
    })

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('[usher/merch-orders] Error:', error)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}
