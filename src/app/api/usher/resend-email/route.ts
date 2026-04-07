import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendETicketEmail } from '@/lib/email'
import QRCode from 'qrcode'

// POST /api/usher/resend-email
// Resend e-ticket email for a given transactionId
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transactionId } = body

    if (!transactionId) {
      return NextResponse.json(
        { error: 'transactionId is required' },
        { status: 400 }
      )
    }

    // Find the transaction
    const transaction = await db.transaction.findUnique({
      where: { transactionId },
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaksi tidak ditemukan' },
        { status: 404 }
      )
    }

    if (transaction.paymentStatus !== 'PAID') {
      return NextResponse.json(
        { error: 'Hanya transaksi yang sudah dibayar yang bisa dikirim ulang' },
        { status: 400 }
      )
    }

    // Parse seat codes
    let seatCodes: string[]
    try {
      seatCodes = JSON.parse(transaction.seatCodes)
    } catch {
      seatCodes = transaction.seatCodes.split(',').map((s: string) => s.trim()).filter(Boolean)
    }

    // Get event info
    const event = await db.event.findUnique({
      where: { id: transaction.eventId },
    })

    if (!event) {
      return NextResponse.json(
        { error: 'Event tidak ditemukan' },
        { status: 404 }
      )
    }

    // Get or generate QR code
    let qrDataUrl = transaction.qrCodeUrl || ''
    if (!qrDataUrl || qrDataUrl === transactionId) {
      const qrText = 'NAMA: ' + transaction.customerName + ' | KURSI: ' + JSON.stringify(seatCodes) + ' | KODE TRX: ' + transaction.transactionId
      qrDataUrl = await QRCode.toDataURL(qrText)

      // Save QR code to transaction
      await db.transaction.update({
        where: { transactionId },
        data: { qrCodeUrl: qrDataUrl },
      })
    }

    // Get email template
    const emailTemplate = await db.emailTemplate.findFirst({ where: { isActive: true } })

    // Format date
    const showDate = new Date(event.showDate).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    // Send email (synchronous — wait for result)
    try {
      await sendETicketEmail({
        customerName: transaction.customerName,
        customerEmail: transaction.customerEmail,
        eventName: event.title,
        showDate,
        location: event.location,
        seatCodes,
        transactionId: transaction.transactionId,
        totalAmount: transaction.totalAmount,
        qrCodeDataUrl: qrDataUrl,
        template: emailTemplate
          ? {
              greeting: emailTemplate.greeting,
              rules: emailTemplate.rules,
              notes: emailTemplate.notes,
              footer: emailTemplate.footer,
            }
          : undefined,
      })

      return NextResponse.json({
        success: true,
        message: `E-tiket berhasil dikirim ulang ke ${transaction.customerEmail}`,
      })
    } catch (emailError: any) {
      console.error('[RESEND-EMAIL] Failed to send email:', emailError?.message || emailError)
      return NextResponse.json(
        { error: `Gagal mengirim email: ${emailError?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[RESEND-EMAIL] Error:', error)
    return NextResponse.json(
      { error: 'Gagal mengirim ulang e-tiket' },
      { status: 500 }
    )
  }
}
