import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const LOCK_EXPIRY_MS = 2 * 60 * 60 * 1000 // 2 hours

// PUT — Auto-save layout data
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seatMapId } = await params
    const body = await request.json()
    const { layoutData, adminId } = body

    if (!adminId) {
      return NextResponse.json(
        { error: 'adminId is required' },
        { status: 400 }
      )
    }

    if (layoutData === undefined) {
      return NextResponse.json(
        { error: 'layoutData is required' },
        { status: 400 }
      )
    }

    // Verify seat map exists and is not a system template
    const seatMap = await db.seatMap.findUnique({ where: { id: seatMapId } })
    if (!seatMap) {
      return NextResponse.json({ error: 'Seat map not found' }, { status: 404 })
    }

    if (seatMap.isTemplate) {
      return NextResponse.json(
        { error: 'Seat map template tidak bisa diedit.' },
        { status: 403 }
      )
    }

    // Verify the caller holds the editor lock
    const lock = await db.mapEditorLock.findUnique({
      where: { seatMapId },
    })

    if (!lock) {
      return NextResponse.json(
        { error: 'No editor lock found. Please acquire a lock before auto-saving.' },
        { status: 403 }
      )
    }

    // Check if lock is expired
    const twoHoursAgo = new Date(Date.now() - LOCK_EXPIRY_MS)
    if (lock.lockedAt < twoHoursAgo) {
      // Lock expired, clean it up
      await db.mapEditorLock.delete({ where: { seatMapId } })
      return NextResponse.json(
        { error: 'Editor lock has expired. Please re-acquire the lock.' },
        { status: 403 }
      )
    }

    // Verify the lock belongs to the requesting admin
    if (lock.lockedByAdminId !== adminId) {
      return NextResponse.json(
        { error: 'You do not hold the editor lock for this seat map.' },
        { status: 403 }
      )
    }

    // Update the seat map layout data
    await db.seatMap.update({
      where: { id: seatMapId },
      data: { layoutData },
    })

    return NextResponse.json({
      success: true,
      savedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error auto-saving seat map:', error)
    return NextResponse.json(
      { error: 'Failed to auto-save seat map' },
      { status: 500 }
    )
  }
}
