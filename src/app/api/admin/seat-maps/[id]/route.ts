import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const seatMap = await db.seatMap.findUnique({ where: { id } })
    if (!seatMap) {
      return NextResponse.json({ error: 'Seat map not found' }, { status: 404 })
    }

    return NextResponse.json({ seatMap })
  } catch (error) {
    console.error('Error fetching seat map:', error)
    return NextResponse.json(
      { error: 'Failed to fetch seat map' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, layoutData, stageType } = body

    const seatMap = await db.seatMap.findUnique({ where: { id } })
    if (!seatMap) {
      return NextResponse.json({ error: 'Seat map not found' }, { status: 404 })
    }

    // Prevent modifying system templates
    if (seatMap.isTemplate && layoutData !== undefined) {
      return NextResponse.json(
        { error: 'Seat map template tidak bisa diedit. Gunakan sebagai template untuk membuat seat map baru.' },
        { status: 403 }
      )
    }

    const updated = await db.seatMap.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(layoutData !== undefined && { layoutData }),
        ...(stageType !== undefined && { stageType }),
      },
    })

    return NextResponse.json({ seatMap: updated })
  } catch (error) {
    console.error('Error updating seat map:', error)
    return NextResponse.json(
      { error: 'Failed to update seat map' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const seatMap = await db.seatMap.findUnique({ where: { id } })
    if (!seatMap) {
      return NextResponse.json({ error: 'Seat map not found' }, { status: 404 })
    }

    // Prevent deleting system templates
    if (seatMap.isTemplate) {
      return NextResponse.json(
        { error: 'Seat map template tidak bisa dihapus.' },
        { status: 403 }
      )
    }

    // Check if any events are using this seat map
    const eventsUsingMap = await db.event.count({
      where: { seatMapId: id },
    })

    if (eventsUsingMap > 0) {
      return NextResponse.json(
        {
          error: `Seat map cannot be deleted because it is being used by ${eventsUsingMap} event(s). Please remove the seat map from all events first.`,
        },
        { status: 409 }
      )
    }

    await db.mapEditorLock.deleteMany({ where: { seatMapId: id } })
    await db.seatMap.delete({ where: { id } })

    return NextResponse.json({ message: 'Seat map deleted successfully' })
  } catch (error) {
    console.error('Error deleting seat map:', error)
    return NextResponse.json(
      { error: 'Failed to delete seat map' },
      { status: 500 }
    )
  }
}
