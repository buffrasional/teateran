import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Jakarta timezone offset in minutes (UTC+7)
const JAKARTA_OFFSET = 7 * 60

function getJakartaNow(): Date {
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000
  return new Date(utcMs + JAKARTA_OFFSET * 60 * 1000)
}

function toJakarta(date: Date): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000
  return new Date(utcMs + JAKARTA_OFFSET * 60 * 1000)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, eventId, seatCount, hasMerchandise } = body

    if (!code || !eventId) {
      return NextResponse.json(
        { valid: false, error: 'code and eventId are required' },
        { status: 400 }
      )
    }

    const promoCode = await db.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    })

    if (!promoCode) {
      return NextResponse.json({ valid: false, error: 'Kode promo tidak ditemukan' })
    }
    if (!promoCode.isActive) {
      return NextResponse.json({ valid: false, error: 'Kode promo sudah tidak aktif' })
    }
    if (promoCode.currentUses >= promoCode.maxUses) {
      return NextResponse.json({ valid: false, error: 'Kode promo sudah mencapai batas penggunaan' })
    }
    if (promoCode.eventId && promoCode.eventId !== eventId) {
      return NextResponse.json({ valid: false, error: 'Kode promo tidak berlaku untuk event ini' })
    }

    // Date validation in Jakarta timezone
    const nowJakarta = getJakartaNow()
    const fromJakarta = toJakarta(new Date(promoCode.validFrom))
    const untilJakarta = toJakarta(new Date(promoCode.validUntil))

    if (nowJakarta < fromJakarta) {
      return NextResponse.json({ valid: false, error: 'Kode promo belum berlaku' })
    }
    if (nowJakarta > untilJakarta) {
      return NextResponse.json({ valid: false, error: 'Kode promo sudah kadaluarsa' })
    }

    // Validate minimum requirements
    const seats = seatCount || 0
    const hasMerch = hasMerchandise === true

    if (seats < (promoCode.minTickets || 0)) {
      return NextResponse.json({
        valid: false,
        error: `Promo ini berlaku untuk pembelian minimal ${promoCode.minTickets} tiket`,
      })
    }
    if (!hasMerch && (promoCode.minMerchItems || 0) > 0) {
      return NextResponse.json({
        valid: false,
        error: `Promo ini berlaku jika membeli minimal ${promoCode.minMerchItems} merchandise`,
      })
    }

    // Validate target requirements
    const target = promoCode.target || 'ALL'
    if (target === 'BUNDLING' && !(seats > 0 && hasMerch)) {
      return NextResponse.json({
        valid: false,
        error: 'Promo bundling hanya berlaku jika membeli tiket + merchandise',
      })
    }
    if (target === 'MERCH' && !hasMerch) {
      return NextResponse.json({
        valid: false,
        error: 'Promo ini hanya berlaku untuk merchandise',
      })
    }

    return NextResponse.json({
      valid: true,
      id: promoCode.id,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      code: promoCode.code,
      target: promoCode.target,
      isPerItem: promoCode.isPerItem,
    })
  } catch (error) {
    console.error('Error validating promo code:', error)
    return NextResponse.json(
      { valid: false, error: 'Gagal memvalidasi kode promo' },
      { status: 500 }
    )
  }
}
