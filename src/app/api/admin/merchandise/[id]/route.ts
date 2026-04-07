import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const merchandise = await db.merchandise.findUnique({ where: { id } })
    if (!merchandise) {
      return NextResponse.json({ error: 'Merchandise not found' }, { status: 404 })
    }

    return NextResponse.json({ merchandise })
  } catch (error) {
    console.error('Error fetching merchandise:', error)
    return NextResponse.json(
      { error: 'Failed to fetch merchandise' },
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
    const { name, description, price, stock, imageUrl } = body

    const existing = await db.merchandise.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Merchandise not found' }, { status: 404 })
    }

    const merchandise = await db.merchandise.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        description: description !== undefined ? description : existing.description,
        price: price !== undefined ? price : existing.price,
        stock: stock !== undefined ? stock : existing.stock,
        imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
      },
    })

    return NextResponse.json({ merchandise })
  } catch (error) {
    console.error('Error updating merchandise:', error)
    return NextResponse.json(
      { error: 'Failed to update merchandise' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.merchandise.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Merchandise not found' }, { status: 404 })
    }

    await db.merchandise.delete({ where: { id } })

    return NextResponse.json({ message: 'Merchandise deleted successfully' })
  } catch (error) {
    console.error('Error deleting merchandise:', error)
    return NextResponse.json(
      { error: 'Failed to delete merchandise' },
      { status: 500 }
    )
  }
}
