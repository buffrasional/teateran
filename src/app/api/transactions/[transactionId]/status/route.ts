import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMidtransConfig } from '@/lib/midtrans'
import QRCode from 'qrcode'

/**
 * GET /api/transactions/[transactionId]/status
 * 
 * Polls Midtrans API directly for payment status (bypasses webhook).
 * Needed in development where localhost webhooks are unreachable.
 * On settlement: updates DB → marks seats SOLD → generates QR → sends email.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params

    const transaction = await db.transaction.findUnique({
      where: { transactionId },
      include: { event: true },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Already paid — return immediately
    if (transaction.paymentStatus === 'PAID') {
      return NextResponse.json({
        transactionId: transaction.transactionId,
        paymentStatus: transaction.paymentStatus,
        paidAt: transaction.paidAt,
        qrCodeUrl: transaction.qrCodeUrl,
      })
    }

    // Query Midtrans API for the real status
    const config = getMidtransConfig()
    const authString = Buffer.from(config.serverKey + ':').toString('base64')

    const midtransRes = await fetch(
      `https://api.${config.isProduction ? 'midtrans.com' : 'sandbox.midtrans.com'}/v2/${transactionId}/status`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${authString}`,
        },
      }
    )

    if (!midtransRes.ok) {
      console.error(`[status-check] Midtrans API error: ${midtransRes.status}`)
      return NextResponse.json({
        transactionId: transaction.transactionId,
        paymentStatus: transaction.paymentStatus,
      })
    }

    const midtransData = await midtransRes.json()
    const midtransStatus: string = midtransData.transaction_status

    console.log(`[status-check] ${transactionId}: Midtrans="${midtransStatus}" DB="${transaction.paymentStatus}"`)

    // ── PAYMENT SUCCESS ──
    if (midtransStatus === 'settlement' && transaction.paymentStatus !== 'PAID') {
      const seatCodes: string[] = JSON.parse(transaction.seatCodes)

      await db.transaction.update({
        where: { transactionId },
        data: {
          paymentStatus: 'PAID',
          paidAt: new Date(),
          midtransId: midtransData.transaction_id || null,
        },
      })

      await db.$transaction(
        seatCodes.map((code) =>
          db.seat.updateMany({
            where: { eventId: transaction.eventId, seatCode: code },
            data: { status: 'SOLD', lockedUntil: null, lockedBy: null },
          })
        )
      )

      const qrText = `NAMA: ${transaction.customerName} | KURSI: ${transaction.seatCodes} | KODE TRX: ${transaction.transactionId}`
      const qrDataUrl = await QRCode.toDataURL(qrText)

      await db.transaction.update({
        where: { transactionId },
        data: { qrCodeUrl: qrDataUrl },
      })

      // Fire-and-forget email
      try {
        const { sendETicketEmail } = await import('@/lib/email')
        const emailTemplate = await db.emailTemplate.findFirst({ where: { isActive: true } })
        const showDate = new Date(transaction.event.showDate).toLocaleDateString('id-ID', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
        sendETicketEmail({
          customerName: transaction.customerName,
          customerEmail: transaction.customerEmail,
          eventName: transaction.event.title,
          showDate,
          location: transaction.event.location,
          seatCodes,
          transactionId: transaction.transactionId,
          totalAmount: transaction.totalAmount,
          qrCodeDataUrl: qrDataUrl,
          template: emailTemplate
            ? { greeting: emailTemplate.greeting, rules: emailTemplate.rules, notes: emailTemplate.notes, footer: emailTemplate.footer }
            : undefined,
        }).catch((e) => console.error('Email send failed:', e))
      } catch (e) {
        console.error('Email setup failed:', e)
      }

      const updated = await db.transaction.findUnique({
        where: { transactionId },
        select: { transactionId: true, paymentStatus: true, paidAt: true, qrCodeUrl: true },
      })
      return NextResponse.json(updated)
    }

    // ── EXPIRE / FAILURE / CANCEL ──
    if (['expire', 'failure', 'cancel'].includes(midtransStatus) && transaction.paymentStatus === 'PENDING') {
      const seatCodes: string[] = JSON.parse(transaction.seatCodes)
      const newStatus = midtransStatus === 'expire' ? 'EXPIRED' : 'FAILED'

      await db.transaction.update({
        where: { transactionId },
        data: {
          paymentStatus: newStatus as 'EXPIRED' | 'FAILED',
          expiredAt: new Date(),
          midtransId: midtransData.transaction_id || null,
        },
      })

      await db.$transaction(
        seatCodes.map((code) =>
          db.seat.updateMany({
            where: { eventId: transaction.eventId, seatCode: code },
            data: { status: 'AVAILABLE', lockedUntil: null, lockedBy: null },
          })
        )
      )
    }

    const current = await db.transaction.findUnique({
      where: { transactionId },
      select: { transactionId: true, paymentStatus: true, paidAt: true, qrCodeUrl: true },
    })
    return NextResponse.json(current)
  } catch (error) {
    console.error('Error checking transaction status:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}
