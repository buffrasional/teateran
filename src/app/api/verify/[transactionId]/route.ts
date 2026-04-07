import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifySignature } from '@/lib/midtrans'
import QRCode from 'qrcode'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params

    // Fetch transaction WITHOUT include — separate queries
    const transaction = await db.transaction.findUnique({
      where: { transactionId },
      select: {
        transactionId: true,
        customerName: true,
        customerEmail: true,
        customerWa: true,
        seatCodes: true,
        totalAmount: true,
        paymentStatus: true,
        qrCodeUrl: true,
        paidAt: true,
        eventId: true,
        createdAt: true,
        merchandiseData: true,
        adminFeeApplied: true,
        promoCodeId: true,
      },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // If still PENDING, check Midtrans directly for latest status
    if (transaction.paymentStatus === 'PENDING') {
      try {
        const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
        const auth = Buffer.from(serverKey + ':').toString('base64')
        const isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true'
        // Use V2 Status API (NOT Snap V1 — that returns "token not found")
        const statusUrl = isProd
          ? 'https://api.midtrans.com/v2/' + transactionId + '/status'
          : 'https://api.sandbox.midtrans.com/v2/' + transactionId + '/status'

        const statusRes = await fetch(statusUrl, {
          headers: { Authorization: 'Basic ' + auth, Accept: 'application/json' },
        })

        if (statusRes.ok) {
          const midtransData = await statusRes.json()
          const midtransStatus = midtransData.transaction_status

          if (midtransStatus === 'settlement') {
            // Payment success! Update DB
            const seatCodes: string[] = JSON.parse(transaction.seatCodes)

            await db.transaction.update({
              where: { transactionId },
              data: { paymentStatus: 'PAID', paidAt: new Date(), midtransId: midtransData.transaction_id || null },
            })

            // Mark seats as SOLD (clear lockedBy too)
            await db.seat.updateMany({
              where: { eventId: transaction.eventId, seatCode: { in: seatCodes } },
              data: { status: 'SOLD', lockedUntil: null, lockedBy: null },
            })

            // Generate QR code
            const qrText = 'NAMA: ' + transaction.customerName + ' | KURSI: ' + transaction.seatCodes + ' | KODE TRX: ' + transaction.transactionId
            const qrDataUrl = await QRCode.toDataURL(qrText)
            await db.transaction.update({
              where: { transactionId },
              data: { qrCodeUrl: qrDataUrl },
            })

            // Send email
            const event = await db.event.findUnique({ where: { id: transaction.eventId } })
            const emailTemplate = await db.emailTemplate.findFirst({ where: { isActive: true } })

            if (event) {
              const showDate = new Date(event.showDate).toLocaleDateString('id-ID', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })

              const { sendETicketEmail } = await import('@/lib/email')
              console.log('[VERIFY] Sending e-ticket email to:', transaction.customerEmail, 'for order:', transactionId)
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
                console.log('[VERIFY] E-ticket email sent successfully to:', transaction.customerEmail)
              }).catch((err: any) => console.error('[VERIFY] Email error:', err))
            }

            // Refetch updated transaction
            const updated = await db.transaction.findUnique({
              where: { transactionId },
              select: {
                transactionId: true, customerName: true, customerEmail: true, customerWa: true,
                seatCodes: true, totalAmount: true, paymentStatus: true, qrCodeUrl: true, paidAt: true,
                eventId: true, createdAt: true, merchandiseData: true, adminFeeApplied: true, promoCodeId: true,
              },
            })

            // Get event for response
            const eventData = await db.event.findUnique({ where: { id: updated!.eventId }, select: { title: true, showDate: true, location: true, posterUrl: true } })

            return NextResponse.json({ transaction: { ...updated!, event: eventData! }, justPaid: true })
          }

          if (midtransStatus === 'expire' || midtransStatus === 'failure' || midtransStatus === 'cancel') {
            const newStatus = midtransStatus === 'expire' ? 'EXPIRED' : 'FAILED'
            const seatCodes: string[] = JSON.parse(transaction.seatCodes)

            await db.transaction.update({
              where: { transactionId },
              data: { paymentStatus: newStatus, expiredAt: new Date() },
            })

            await db.seat.updateMany({
              where: { eventId: transaction.eventId, seatCode: { in: seatCodes } },
              data: { status: 'AVAILABLE', lockedUntil: null, lockedBy: null },
            })

            const updated = await db.transaction.findUnique({
              where: { transactionId },
              select: {
                transactionId: true, customerName: true, customerEmail: true, customerWa: true,
                seatCodes: true, totalAmount: true, paymentStatus: true, qrCodeUrl: true, paidAt: true,
                eventId: true, createdAt: true, merchandiseData: true, adminFeeApplied: true, promoCodeId: true,
              },
            })
            const eventData = await db.event.findUnique({ where: { id: updated!.eventId }, select: { title: true, showDate: true, location: true, posterUrl: true } })

            return NextResponse.json({ transaction: { ...updated!, event: eventData! }, midtransStatus })
          }

          // Still pending at Midtrans
          const eventData = await db.event.findUnique({ where: { id: transaction.eventId }, select: { title: true, showDate: true, location: true, posterUrl: true } })
          return NextResponse.json({ transaction: { ...transaction, event: eventData! }, midtransStatus })
        }
      } catch (midtransErr) {
        console.error('[verify] Midtrans check error:', midtransErr)
        // Fall through to return DB data
      }
    }

    // Return DB data as-is
    const eventData = await db.event.findUnique({ where: { id: transaction.eventId }, select: { title: true, showDate: true, location: true, posterUrl: true } })
    return NextResponse.json({ transaction: { ...transaction, event: eventData! } })
  } catch (error) {
    console.error('Error verifying transaction:', error)
    return NextResponse.json({ error: 'Failed to verify transaction' }, { status: 500 })
  }
}
