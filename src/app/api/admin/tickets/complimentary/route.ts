import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendETicketEmail } from '@/lib/email'
import QRCode from 'qrcode'

function generateCompTransactionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = ''
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `COMP-${id}`
}

async function generateUniqueCompTransactionId(): Promise<string> {
  let isUnique = false
  let result: string

  while (!isUnique) {
    result = generateCompTransactionId()
    const existing = await db.transaction.findUnique({
      where: { transactionId: result },
    })
    if (!existing) {
      isUnique = true
    }
  }

  return result!
}

// GET: Fetch recent complimentary tickets
export async function GET() {
  try {
    const tickets = await db.transaction.findMany({
      where: {
        transactionId: { startsWith: 'COMP-' },
        paymentStatus: 'PAID',
        totalAmount: 0,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Get event titles
    const eventIds = [...new Set(tickets.map((t) => t.eventId))]
    const events = await db.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, title: true },
    })
    const eventMap: Record<string, string> = {}
    for (const e of events) eventMap[e.id] = e.title

    const total = await db.transaction.count({
      where: {
        transactionId: { startsWith: 'COMP-' },
        paymentStatus: 'PAID',
        totalAmount: 0,
      },
    })

    const result = tickets.map((t) => ({
      ...t,
      eventTitle: eventMap[t.eventId] || 'Unknown',
      emailSent: !!t.qrCodeUrl, // If QR was generated, email was attempted
    }))

    return NextResponse.json({ tickets: result, total })
  } catch (error) {
    console.error('Error fetching complimentary tickets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch complimentary tickets' },
      { status: 500 }
    )
  }
}

// POST: Create complimentary ticket
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, seatCodes, guestName, guestEmail, guestPhone, showDateId } = body

    // Validate required fields
    if (!eventId || !seatCodes || !Array.isArray(seatCodes) || seatCodes.length === 0 || !guestName || !guestEmail) {
      return NextResponse.json(
        { error: 'eventId, seatCodes (non-empty array), guestName, and guestEmail are required' },
        { status: 400 }
      )
    }

    // Validate event exists
    const event = await db.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Determine if this is a numbered or GA event
    const isNumbered = event.seatMapId
      ? await db.seatMap.findUnique({ where: { id: event.seatMapId } })
          .then((sm) => sm?.seatType === 'NUMBERED')
      : false

    if (isNumbered) {
      // ─── NUMBERED: Seats must already exist in DB ───────────────────
      const existingSeats = await db.seat.findMany({
        where: {
          eventId,
          seatCode: { in: seatCodes },
          ...(showDateId ? { eventShowDateId: showDateId } : {}),
        },
      })

      if (existingSeats.length !== seatCodes.length) {
        const foundCodes = existingSeats.map((s) => s.seatCode)
        const missingCodes = seatCodes.filter((c: string) => !foundCodes.includes(c))
        return NextResponse.json(
          { error: `Kursi tidak ditemukan: ${missingCodes.join(', ')}. Pastikan kursi sudah di-generate dari Seat Map.` },
          { status: 400 }
        )
      }

      const unavailableSeats = existingSeats.filter((s) => s.status !== 'AVAILABLE')
      if (unavailableSeats.length > 0) {
        return NextResponse.json(
          { error: `Kursi sudah terisi/tidak tersedia: ${unavailableSeats.map((s) => s.seatCode).join(', ')}` },
          { status: 400 }
        )
      }

      // Update seats to INVITATION status
      await db.seat.updateMany({
        where: {
          eventId,
          seatCode: { in: seatCodes },
          ...(showDateId ? { eventShowDateId: showDateId } : {}),
        },
        data: { status: 'INVITATION', lockedUntil: null, lockedBy: null },
      })
    } else {
      // ─── GENERAL ADMISSION: Create seats on-the-fly ────────────────
      for (const code of seatCodes) {
        // Check if seat code already exists
        const exists = await db.seat.findFirst({
          where: { eventId, seatCode: code },
        })
        if (exists) {
          if (exists.status !== 'AVAILABLE') {
            return NextResponse.json(
              { error: `Kursi ${code} sudah terisi.` },
              { status: 400 }
            )
          }
          // Mark existing as INVITATION
          await db.seat.update({
            where: { id: exists.id },
            data: { status: 'INVITATION', lockedUntil: null, lockedBy: null },
          })
        } else {
          // Create new GA seat
          await db.seat.create({
            data: {
              eventId,
              seatCode: code,
              status: 'INVITATION',
              row: code.split('-')[0] || 'GA',
              col: parseInt(code.split('-')[1] || '0') || 0,
              zoneName: code.split('-')[0] || null,
            },
          })
        }
      }
    }

    // Generate unique transaction ID
    const transactionId = await generateUniqueCompTransactionId()

    // Create transaction
    const transaction = await db.transaction.create({
      data: {
        transactionId,
        eventId,
        customerName: guestName,
        customerEmail: guestEmail,
        customerWa: guestPhone || '',
        seatCodes: JSON.stringify(seatCodes),
        totalAmount: 0,
        paymentStatus: 'PAID',
        paidAt: new Date(),
        qrCodeUrl: transactionId, // placeholder, will be updated after QR generation
        ...(showDateId ? { showDateId } : {}),
      },
    })

    // Generate QR code
    const qrText = 'NAMA: ' + guestName + ' | KURSI: ' + JSON.stringify(seatCodes) + ' | KODE TRX: ' + transactionId
    const qrDataUrl = await QRCode.toDataURL(qrText)

    // Update transaction with QR code URL
    await db.transaction.update({
      where: { transactionId },
      data: { qrCodeUrl: qrDataUrl },
    })

    // Fetch active email template
    const emailTemplate = await db.emailTemplate.findFirst({ where: { isActive: true } })

    // Send e-ticket email (fire-and-forget)
    const showDate = new Date(event.showDate).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    sendETicketEmail({
      customerName: guestName,
      customerEmail: guestEmail,
      eventName: event.title,
      showDate,
      location: event.location,
      seatCodes,
      transactionId,
      totalAmount: 0,
      qrCodeDataUrl: qrDataUrl,
      template: emailTemplate
        ? {
            greeting: emailTemplate.greeting,
            rules: emailTemplate.rules,
            notes: emailTemplate.notes,
            footer: emailTemplate.footer,
          }
        : undefined,
    }).catch((emailError: unknown) =>
      console.error('Failed to send complimentary e-ticket email:', emailError)
    )

    return NextResponse.json({ success: true, transactionId, transaction })
  } catch (error) {
    console.error('Error creating complimentary ticket:', error)
    return NextResponse.json(
      { error: 'Failed to create complimentary ticket' },
      { status: 500 }
    )
  }
}
