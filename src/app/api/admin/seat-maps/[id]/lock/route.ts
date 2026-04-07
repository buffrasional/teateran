import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const LOCK_EXPIRY_MS = 2 * 60 * 60 * 1000 // 2 hours

// Helper: clean up expired locks for a seat map
async function cleanExpiredLocks(seatMapId: string) {
  const twoHoursAgo = new Date(Date.now() - LOCK_EXPIRY_MS)
  const existingLock = await db.mapEditorLock.findUnique({
    where: { seatMapId },
  })

  if (existingLock && existingLock.lockedAt < twoHoursAgo) {
    await db.mapEditorLock.delete({
      where: { seatMapId },
    })
  }
}

// POST — Acquire lock
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seatMapId } = await params
    const body = await request.json()
    const { adminId, adminName } = body

    if (!adminId || !adminName) {
      return NextResponse.json(
        { error: 'adminId and adminName are required' },
        { status: 400 }
      )
    }

    // Verify seat map exists
    const seatMap = await db.seatMap.findUnique({ where: { id: seatMapId } })
    if (!seatMap) {
      return NextResponse.json({ error: 'Seat map not found' }, { status: 404 })
    }

    // Clean up expired locks first
    await cleanExpiredLocks(seatMapId)

    // Check if a lock already exists
    const existingLock = await db.mapEditorLock.findUnique({
      where: { seatMapId },
    })

    if (existingLock) {
      return NextResponse.json(
        {
          error: `Seat Map sedang diedit oleh ${existingLock.lockedBy || existingLock.lockedByAdminId}`,
          lockedBy: existingLock.lockedBy || existingLock.lockedByAdminId,
        },
        { status: 409 }
      )
    }

    // Create lock
    const lock = await db.mapEditorLock.create({
      data: {
        seatMapId,
        lockedByAdminId: adminId,
        lockedByAdmin: adminName,
      },
    })

    return NextResponse.json({ lock }, { status: 201 })
  } catch (error) {
    console.error('Error acquiring seat map lock:', error)
    return NextResponse.json(
      { error: 'Failed to acquire lock' },
      { status: 500 }
    )
  }
}

// GET — Check lock status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seatMapId } = await params

    // Clean up expired locks first
    await cleanExpiredLocks(seatMapId)

    const lock = await db.mapEditorLock.findUnique({
      where: { seatMapId },
    })

    if (!lock) {
      return NextResponse.json({ locked: false })
    }

    return NextResponse.json({
      locked: true,
      lockedBy: lock.lockedByAdmin || lock.lockedByAdminId,
      lockedAt: lock.lockedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error checking seat map lock:', error)
    return NextResponse.json(
      { error: 'Failed to check lock' },
      { status: 500 }
    )
  }
}

// DELETE — Release lock
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seatMapId } = await params
    const body = await request.json()
    const { adminId } = body

    if (!adminId) {
      return NextResponse.json(
        { error: 'adminId is required' },
        { status: 400 }
      )
    }

    const existingLock = await db.mapEditorLock.findUnique({
      where: { seatMapId },
    })

    if (!existingLock) {
      return NextResponse.json({ success: true, message: 'No lock found' })
    }

    // Only allow the admin who holds the lock to release it
    if (existingLock.lockedByAdminId !== adminId) {
      return NextResponse.json(
        { error: 'Only the admin who holds the lock can release it' },
        { status: 403 }
      )
    }

    await db.mapEditorLock.delete({
      where: { seatMapId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error releasing seat map lock:', error)
    return NextResponse.json(
      { error: 'Failed to release lock' },
      { status: 500 }
    )
  }
}
