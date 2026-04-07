import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Checkout locks use "CK:" prefix. Seat-map locks use plain sessionId.
const CHECKOUT_PREFIX = 'CK:'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, seatCodes, sessionId, showDateId } = body

    if (!eventId || !seatCodes || !Array.isArray(seatCodes) || seatCodes.length === 0) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const seatWhere: any = { eventId, seatCode: { in: seatCodes } }
    if (showDateId) seatWhere.eventShowDateId = showDateId

    const seats = await db.seat.findMany({ where: seatWhere })
    if (seats.length !== seatCodes.length) {
      return NextResponse.json({ error: 'Seats not found' }, { status: 404 })
    }

    // 1. Reject SOLD seats
    const sold = seats.filter((s) => s.status === 'SOLD')
    if (sold.length > 0) {
      return NextResponse.json(
        { error: 'Seats already sold: ' + sold.map((s) => s.seatCode).join(', '), rejectedSeats: sold.map((s) => s.seatCode) },
        { status: 409 }
      )
    }

    // 2. Reject seats locked by ANOTHER CHECKOUT session (someone is paying)
    const now = new Date()
    const lockedByOtherCheckout = seats.filter(
      (s) => s.status === 'LOCKED_TEMPORARY' && s.lockedUntil && s.lockedUntil > now && s.lockedBy && s.lockedBy.startsWith(CHECKOUT_PREFIX) && s.lockedBy !== CHECKOUT_PREFIX + sessionId
    )
    if (lockedByOtherCheckout.length > 0) {
      return NextResponse.json(
        { error: 'Kursi ' + lockedByOtherCheckout.map((s) => s.seatCode).join(', ') + ' sedang diproses pembayaran', rejectedSeats: lockedByOtherCheckout.map((s) => s.seatCode) },
        { status: 409 }
      )
    }

    // 3. Reject seats locked by ANOTHER seat-map session
    const lockedByOtherSeatmap = seats.filter(
      (s) => s.status === 'LOCKED_TEMPORARY' && s.lockedUntil && s.lockedUntil > now && s.lockedBy && !s.lockedBy.startsWith(CHECKOUT_PREFIX) && s.lockedBy !== sessionId
    )
    if (lockedByOtherSeatmap.length > 0) {
      return NextResponse.json(
        { error: 'Kursi ' + lockedByOtherSeatmap.map((s) => s.seatCode).join(', ') + ' sedang dipilih orang lain', rejectedSeats: lockedByOtherSeatmap.map((s) => s.seatCode) },
        { status: 409 }
      )
    }

    // 4. Lock: only seats that are AVAILABLE, locked by THIS session, or EXPIRED
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000)
    const lockWhere: any = {
      eventId,
      seatCode: { in: seatCodes },
      OR: [
        { status: 'AVAILABLE' },
        { status: 'LOCKED_TEMPORARY', lockedBy: sessionId },
        { status: 'LOCKED_TEMPORARY', lockedUntil: { lt: new Date() } },
      ],
    }
    if (showDateId) lockWhere.eventShowDateId = showDateId

    const result = await db.seat.updateMany({
      where: lockWhere,
      data: { status: 'LOCKED_TEMPORARY', lockedUntil, lockedBy: sessionId },
    })

    // Race condition check
    if (result.count !== seatCodes.length) {
      const raceWhere: any = { eventId, seatCode: { in: seatCodes }, lockedBy: sessionId }
      if (showDateId) raceWhere.eventShowDateId = showDateId
      const updated = await db.seat.findMany({
        where: raceWhere,
        select: { seatCode: true },
      })
      const updatedCodes = new Set(updated.map((s) => s.seatCode))
      const failedCodes = seatCodes.filter((c) => !updatedCodes.has(c))

      return NextResponse.json(
        { error: 'Kursi ' + failedCodes.join(', ') + ' baru saja diambil orang lain.', rejectedSeats: failedCodes },
        { status: 409 }
      )
    }

    return NextResponse.json({ ok: true, seatCodes, lockedUntil, updated: result.count })
  } catch (error) {
    console.error('[lock]', error)
    return NextResponse.json({ error: 'Lock failed' }, { status: 500 })
  }
}
