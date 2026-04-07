import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    const promoCodes = await db.promoCode.findMany({
      where: eventId ? { eventId } : undefined,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ promoCodes })
  } catch (error) {
    console.error('Error fetching promo codes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch promo codes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      code, eventId, discountType, discountValue, maxUses,
      validFrom, validUntil, isActive, target, isPerItem, minTickets, minMerchItems
    } = body

    if (!code || !discountType || discountValue === undefined || !maxUses || !validFrom || !validUntil) {
      return NextResponse.json(
        { error: 'code, discountType, discountValue, maxUses, validFrom, and validUntil are required' },
        { status: 400 }
      )
    }

    const promoCode = await db.promoCode.create({
      data: {
        code: code.toUpperCase(),
        eventId: eventId || null,
        discountType,
        discountValue,
        maxUses,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        target: target || 'ALL',
        isPerItem: isPerItem === true,
        minTickets: minTickets || 0,
        minMerchItems: minMerchItems || 0,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json({ promoCode }, { status: 201 })
  } catch (error) {
    console.error('Error creating promo code:', error)
    return NextResponse.json(
      { error: 'Failed to create promo code' },
      { status: 500 }
    )
  }
}
