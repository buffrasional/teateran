import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const promoCode = await db.promoCode.findUnique({ where: { id } })
    if (!promoCode) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }
    return NextResponse.json({ promoCode })
  } catch (error) {
    console.error('Error fetching promo code:', error)
    return NextResponse.json({ error: 'Failed to fetch promo code' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      code, eventId, discountType, discountValue, maxUses, currentUses,
      validFrom, validUntil, isActive, target, isPerItem, minTickets, minMerchItems
    } = body

    const existing = await db.promoCode.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }

    const promoCode = await db.promoCode.update({
      where: { id },
      data: {
        code: code !== undefined ? code.toUpperCase() : existing.code,
        eventId: eventId !== undefined ? eventId : existing.eventId,
        discountType: discountType ?? existing.discountType,
        discountValue: discountValue !== undefined ? discountValue : existing.discountValue,
        maxUses: maxUses !== undefined ? maxUses : existing.maxUses,
        currentUses: currentUses !== undefined ? currentUses : existing.currentUses,
        validFrom: validFrom ? new Date(validFrom) : existing.validFrom,
        validUntil: validUntil ? new Date(validUntil) : existing.validUntil,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        target: target || existing.target,
        isPerItem: isPerItem !== undefined ? isPerItem : existing.isPerItem,
        minTickets: minTickets !== undefined ? minTickets : existing.minTickets,
        minMerchItems: minMerchItems !== undefined ? minMerchItems : existing.minMerchItems,
      },
    })

    return NextResponse.json({ promoCode })
  } catch (error) {
    console.error('Error updating promo code:', error)
    return NextResponse.json({ error: 'Failed to update promo code' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await db.promoCode.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
    }
    await db.promoCode.delete({ where: { id } })
    return NextResponse.json({ message: 'Promo code deleted successfully' })
  } catch (error) {
    console.error('Error deleting promo code:', error)
    return NextResponse.json({ error: 'Failed to delete promo code' }, { status: 500 })
  }
}
