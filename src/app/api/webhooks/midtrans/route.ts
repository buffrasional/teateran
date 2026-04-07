import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySignature } from '@/lib/midtrans'
import { sendETicketEmail } from '@/lib/email'
import QRCode from 'qrcode'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      order_id,
      transaction_status,
      status_code,
      gross_amount,
      signature_key,
    } = body

    if (!verifySignature(order_id, status_code, gross_amount, signature_key)) {
      console.error('Invalid signature for order:', order_id)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    // Find transaction — NO include
    const transaction = await db.transaction.findUnique({
      where: { transactionId: order_id },
    })

    if (!transaction) {
      console.error('Transaction not found:', order_id)
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (transaction_status === 'settlement') {
      const seatCodes: string[] = JSON.parse(transaction.seatCodes)

      // Update transaction status
      await db.transaction.update({
        where: { transactionId: order_id },
        data: { paymentStatus: 'PAID', paidAt: new Date(), midtransId: body.transaction_id || null },
      })

      // Bulk update seats to SOLD — clear lockedBy too
      await db.seat.updateMany({
        where: { eventId: transaction.eventId, seatCode: { in: seatCodes } },
        data: { status: 'SOLD', lockedUntil: null, lockedBy: null },
      })

      // Generate QR
      const qrText = 'NAMA: ' + transaction.customerName + ' | KURSI: ' + transaction.seatCodes + ' | KODE TRX: ' + transaction.transactionId
      const qrDataUrl = await QRCode.toDataURL(qrText)

      await db.transaction.update({
        where: { transactionId: order_id },
        data: { qrCodeUrl: qrDataUrl },
      })

      // Get event separately
      const event = await db.event.findUnique({ where: { id: transaction.eventId } })
      const emailTemplate = await db.emailTemplate.findFirst({ where: { isActive: true } })

      if (event) {
        const showDate = new Date(event.showDate).toLocaleDateString('id-ID', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        console.log('[WEBHOOK] Sending e-ticket email to:', transaction.customerEmail, 'for order:', order_id)
        sendETicketEmail({
          customerName: transaction.customerName,
          customerEmail: transaction.customerEmail,
          eventName: event.title,
          showDate,
          location: event.location,
          seatCodes,
          transactionId: transaction.transactionId,
          totalAmount: transaction.totalAmount,
          qrCodeDataUrl: qrDataUrl,
          template: emailTemplate ? { greeting: emailTemplate.greeting, rules: emailTemplate.rules, notes: emailTemplate.notes, footer: emailTemplate.footer } : undefined,
        }).then(() => {
          console.log('[WEBHOOK] E-ticket email sent successfully to:', transaction.customerEmail)
        }).catch((emailError: any) => console.error('[WEBHOOK] Failed to send E-Ticket email:', emailError))
      }

      return NextResponse.json({ status: 'ok' })
    }

    if (transaction_status === 'pending') {
      await db.transaction.update({
        where: { transactionId: order_id },
        data: { paymentStatus: 'PENDING' },
      })
      return NextResponse.json({ status: 'ok' })
    }

    if (transaction_status === 'expire' || transaction_status === 'failure' || transaction_status === 'cancel') {
      const seatCodes: string[] = JSON.parse(transaction.seatCodes)
      const newStatus = transaction_status === 'expire' ? 'EXPIRED' : 'FAILED'

      await db.transaction.update({
        where: { transactionId: order_id },
        data: { paymentStatus: newStatus as 'EXPIRED' | 'FAILED', expiredAt: new Date(), midtransId: body.transaction_id || null },
      })

      // Bulk release seats — clear lockedBy too
      await db.seat.updateMany({
        where: { eventId: transaction.eventId, seatCode: { in: seatCodes } },
        data: { status: 'AVAILABLE', lockedUntil: null, lockedBy: null },
      })

      return NextResponse.json({ status: 'ok' })
    }

    return NextResponse.json({ status: 'ok', transaction_status })
  } catch (error) {
    console.error('Error processing Midtrans webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
