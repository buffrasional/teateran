import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/usher/merchandise — List all transactions with merchandise
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    const where: any = {
      merchandiseData: { not: null },
      paymentStatus: 'PAID',
    }

    if (eventId) {
      where.eventId = eventId
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      select: {
        id: true,
        transactionId: true,
        customerName: true,
        customerEmail: true,
        customerWa: true,
        seatCodes: true,
        totalAmount: true,
        paymentStatus: true,
        merchandiseData: true,
        paidAt: true,
        event: {
          select: { id: true, title: true, showDate: true },
        },
      },
    })

    // Parse and flatten
    const merchOrders: any[] = []
    for (const trx of transactions) {
      let items: any[] = []
      try {
        items = JSON.parse(trx.merchandiseData || '[]')
      } catch {
        items = []
      }
      for (const item of items) {
        merchOrders.push({
          transactionId: trx.transactionId,
          customerName: trx.customerName,
          customerEmail: trx.customerEmail,
          customerWa: trx.customerWa,
          seatCodes: trx.seatCodes,
          eventTitle: trx.event?.title,
          eventDate: trx.event?.showDate,
          merchandiseId: item.merchandiseId,
          merchName: item.name,
          merchPrice: item.price,
          merchQty: item.quantity,
          merchSubtotal: item.price * item.quantity,
          totalAmount: trx.totalAmount,
          paidAt: trx.paidAt,
          eventId: trx.event?.id,
        })
      }
    }

    return NextResponse.json({ orders: merchOrders, total: merchOrders.length })
  } catch (error) {
    console.error('Usher merchandise error:', error)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}
