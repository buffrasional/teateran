import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Checkout locks use "CK:" prefix to distinguish from seat-map locks.
// Seat-map locks: sessionId (e.g., "sess-1234-abc")
// Checkout locks:  "CK:sess-1234-abc" (checkout lock takes priority over seat-map lock)
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

    // Checkout session ID (prefixed to take priority over seat-map locks)
    const checkoutId = CHECKOUT_PREFIX + sessionId

    // 1. Find all requested seats
    const findWhere: any = { eventId, seatCode: { in: seatCodes } }
    if (showDateId) findWhere.eventShowDateId = showDateId

    const seats = await db.seat.findMany({
      where: findWhere,
      select: { seatCode: true, status: true, lockedBy: true },
    })

    if (seats.length !== seatCodes.length) {
      return NextResponse.json({
        ok: false,
        error: 'Beberapa kursi tidak ditemukan. Silakan refresh halaman.',
        takenSeats: seatCodes,
      })
    }

    // 2. Reject SOLD seats
    const soldSeats = seats.filter((s) => s.status === 'SOLD')
    if (soldSeats.length > 0) {
      const taken = soldSeats.map((s) => s.seatCode)
      return NextResponse.json({
        ok: false,
        error: 'Kursi ' + taken.join(', ') + ' sudah terjual. Silakan pilih kursi lain.',
        takenSeats: taken,
      })
    }

    // 3. ATOMIC UNLOCK
    // Only unlock seats that are currently LOCKED_TEMPORARY and locked by this session
    // (either via the map selector sessionId or the checkout prefix).
    const atomicWhere: any = {
      eventId,
      seatCode: { in: seatCodes },
      status: 'LOCKED_TEMPORARY',
      lockedBy: { in: [sessionId, checkoutId] }
    }
    if (showDateId) atomicWhere.eventShowDateId = showDateId

    const result = await db.seat.updateMany({
      where: atomicWhere,
      data: { status: 'AVAILABLE', lockedUntil: null, lockedBy: null },
    })

    return NextResponse.json({
      ok: true,
      unlockedCount: result.count,
    })
  } catch (error) {
    console.error('[confirm-lock]', error)
    return NextResponse.json({ error: 'Lock confirmation failed' }, { status: 500 })
  }
}
