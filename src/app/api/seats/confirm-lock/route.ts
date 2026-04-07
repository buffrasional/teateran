import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const CHECKOUT_PREFIX = 'CK:'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventId, seatCodes, sessionId, showDateId } = body

    if (!eventId || !seatCodes || !Array.isArray(seatCodes) || seatCodes.length === 0) {
      return NextResponse.json(
        { error: 'eventId and seatCodes are required' },
        { status: 400 }
      )
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const checkoutId = CHECKOUT_PREFIX + sessionId

    const seatWhere: any = { eventId, seatCode: { in: seatCodes } }
    if (showDateId) seatWhere.eventShowDateId = showDateId

    const seats = await db.seat.findMany({ where: seatWhere })
    
    if (seats.length !== seatCodes.length) {
      return NextResponse.json({ ok: false, takenSeats: seatCodes })
    }

    // Reject SOLD seats
    const sold = seats.filter((s) => s.status === 'SOLD')
    if (sold.length > 0) {
      return NextResponse.json({ ok: false, takenSeats: sold.map((s) => s.seatCode) })
    }

    // Reject seats locked by ANOTHER ACTIVE CHECKOUT session
    const now = new Date()
    const lockedByOtherCheckout = seats.filter(
      (s) => s.status === 'LOCKED_TEMPORARY' && 
             s.lockedUntil && s.lockedUntil > now && 
             s.lockedBy && s.lockedBy.startsWith(CHECKOUT_PREFIX) && 
             s.lockedBy !== checkoutId
    )
    if (lockedByOtherCheckout.length > 0) {
      return NextResponse.json({ ok: false, takenSeats: lockedByOtherCheckout.map((s) => s.seatCode) })
    }

    // Force escalate the lock to this checkout session atomically (overrides regular seat-map locks/expired locks)
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000) // 10 mins
    
    // ATOMIC UPDATE: only update if it's NOT already locked by another active checkout session
    const whereClause: any = {
      eventId,
      seatCode: { in: seatCodes },
      OR: [
        { status: 'AVAILABLE' },
        { status: 'LOCKED_TEMPORARY', lockedBy: { not: { startsWith: CHECKOUT_PREFIX } } },
        { status: 'LOCKED_TEMPORARY', lockedBy: checkoutId },
        { status: 'LOCKED_TEMPORARY', lockedUntil: { lt: new Date() } },
      ]
    }
    if (showDateId) whereClause.eventShowDateId = showDateId

    const result = await db.seat.updateMany({
      where: whereClause,
      data: {
        status: 'LOCKED_TEMPORARY',
        lockedUntil,
        lockedBy: checkoutId,
      },
    })

    // RACE CONDITION GUARD
    if (result.count !== seatCodes.length) {
      // Find out exactly which seats were taken out from under us
      const raceWhere: any = { eventId, seatCode: { in: seatCodes }, lockedBy: checkoutId }
      if (showDateId) raceWhere.eventShowDateId = showDateId
      const successfullyUpdated = await db.seat.findMany({ where: raceWhere, select: { seatCode: true } })
      const updatedCodes = new Set(successfullyUpdated.map(s => s.seatCode))
      const stolenCodes = seatCodes.filter(c => !updatedCodes.has(c))
      
      return NextResponse.json({ ok: false, takenSeats: stolenCodes })
    }

    return NextResponse.json({
      ok: true,
      message: 'Seats locked for checkout successfully',
      seatCodes,
      updated: result.count,
    })
  } catch (error) {
    console.error('Error confirming lock:', error)
    return NextResponse.json(
      { error: 'Failed to confirm lock', ok: false },
      { status: 500 }
    )
  }
}
