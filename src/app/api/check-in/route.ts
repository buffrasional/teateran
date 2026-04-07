import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactionId } = body

    if (!transactionId) {
      return NextResponse.json(
        { status: 'ERROR', message: 'transactionId is required' },
        { status: 400 }
      )
    }

    const transaction = await db.transaction.findUnique({
      where: { transactionId },
    })

    if (!transaction) {
      return NextResponse.json({
        status: 'ERROR',
        message: 'Transaksi tidak ditemukan',
      })
    }

    if (transaction.paymentStatus !== 'PAID') {
      const statusMessages: Record<string, string> = {
        PENDING: 'Tiket belum dibayar',
        EXPIRED: 'Tiket sudah kadaluarsa',
        FAILED: 'Pembayaran gagal',
      }
      return NextResponse.json({
        status: 'ERROR',
        message: statusMessages[transaction.paymentStatus] || 'Tiket belum dibayar',
      })
    }

    if (transaction.checkInTime) {
      return NextResponse.json({
        status: 'WARNING',
        message: `Sudah di-scan pada ${transaction.checkInTime.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' })}`,
        transaction: {
          transactionId: transaction.transactionId,
          customerName: transaction.customerName,
          customerEmail: transaction.customerEmail,
          customerWa: transaction.customerWa,
          seatCodes: transaction.seatCodes,
          paymentStatus: transaction.paymentStatus,
          checkInTime: transaction.checkInTime,
          paidAt: transaction.paidAt,
          merchandiseData: transaction.merchandiseData,
          totalAmount: transaction.totalAmount,
          adminFeeApplied: transaction.adminFeeApplied,
        },
      })
    }

    // Perform check-in
    const checkedIn = await db.transaction.update({
      where: { transactionId },
      data: { checkInTime: new Date() },
    })

    // Fetch event title separately — NO include
    const event = await db.event.findUnique({ where: { id: checkedIn.eventId } })

    return NextResponse.json({
      status: 'SUCCESS',
      transaction: {
        transactionId: checkedIn.transactionId,
        customerName: checkedIn.customerName,
        customerEmail: checkedIn.customerEmail,
        customerWa: checkedIn.customerWa,
        seatCodes: checkedIn.seatCodes,
        paymentStatus: checkedIn.paymentStatus,
        checkInTime: checkedIn.checkInTime,
        paidAt: checkedIn.paidAt,
        merchandiseData: checkedIn.merchandiseData,
        totalAmount: checkedIn.totalAmount,
        adminFeeApplied: checkedIn.adminFeeApplied,
        eventTitle: event?.title || null,
      },
    })
  } catch (error) {
    console.error('Error checking in ticket:', error)
    return NextResponse.json(
      { status: 'ERROR', message: 'Gagal melakukan check-in' },
      { status: 500 }
    )
  }
}
