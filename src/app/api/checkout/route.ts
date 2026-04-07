import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

const CHECKOUT_PREFIX = 'CK:'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      eventId, showDateId, customerName, customerEmail, customerWa, seatCodes, sessionId,
      promoCodeId, merchandise,
    } = body

    if (!eventId || !customerName || !customerEmail || !customerWa || !seatCodes || !Array.isArray(seatCodes) || seatCodes.length === 0) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Session tidak valid. Silakan refresh halaman.' }, { status: 400 })
    }

    const checkoutId = CHECKOUT_PREFIX + sessionId

    // Validate seats — if showDateId is provided, filter by it
    const seatWhere: any = { eventId, seatCode: { in: seatCodes } }
    if (showDateId) {
      seatWhere.eventShowDateId = showDateId
    }
    const seats = await db.seat.findMany({ where: seatWhere })
    if (seats.length !== seatCodes.length) return NextResponse.json({ error: 'Kursi tidak ditemukan' }, { status: 404 })

    const invalidSeats = seats.filter((s) => s.status === 'SOLD')
    if (invalidSeats.length > 0) {
      return NextResponse.json({ error: 'Kursi ' + invalidSeats.map((s) => s.seatCode).join(', ') + ' sudah terjual' }, { status: 409 })
    }

    const notOurs = seats.filter((s) => s.status === 'LOCKED_TEMPORARY' && s.lockedBy !== checkoutId)
    if (notOurs.length > 0) {
      return NextResponse.json({ error: 'Kursi ' + notOurs.map((s) => s.seatCode).join(', ') + ' sedang dipilih orang lain.' }, { status: 409 })
    }

    // Re-lock seats atomically
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000)
    const lockResult = await db.seat.updateMany({
      where: { eventId, seatCode: { in: seatCodes }, lockedBy: checkoutId },
      data: { status: 'LOCKED_TEMPORARY', lockedUntil, lockedBy: checkoutId },
    })

    if (lockResult.count !== seatCodes.length) {
      return NextResponse.json({ error: 'Gagal mengunci sebagian kursi. Silakan ulangi.' }, { status: 409 })
    }

    // Get event for admin fee
    const event = await db.event.findUnique({ where: { id: eventId }, select: { adminFee: true } })

    // Calculate seat prices
    const priceCats = await db.priceCategory.findMany({ where: { eventId } })
    const seatPrices = await db.seat.findMany({ where: { eventId, seatCode: { in: seatCodes } }, select: { seatCode: true, priceCategoryId: true } })

    let seatTotal = 0
    const items: any[] = []
    for (const s of seatPrices) {
      const cat = priceCats.find((p) => p.id === s.priceCategoryId)
      if (!cat) return NextResponse.json({ error: 'Harga kursi belum diatur' }, { status: 400 })
      seatTotal += cat.price
      items.push({ id: s.seatCode, price: cat.price, quantity: 1, name: 'Kursi ' + s.seatCode, category: 'Tiket' })
    }

    // Admin fee
    const adminFeePerTicket = event?.adminFee || 0
    const adminFeeTotal = adminFeePerTicket * seatCodes.length

    // Add admin fee as item if > 0
    if (adminFeeTotal > 0) {
      items.push({ id: 'ADMIN-FEE', price: adminFeeTotal, quantity: 1, name: 'Biaya Admin', category: 'Biaya' })
    }

    // Promo code - calculate discount (using Jakarta timezone)
    const JAKARTA_OFFSET = 7 * 60
    const toJakarta = (d: Date) => {
      const utcMs = d.getTime() + d.getTimezoneOffset() * 60 * 1000
      return new Date(utcMs + JAKARTA_OFFSET * 60 * 1000)
    }

    let discountAmount = 0
    let promoCodeData: any = null
    let promoTarget = 'ALL'
    if (promoCodeId) {
      promoCodeData = await db.promoCode.findUnique({ where: { id: promoCodeId } })
      promoTarget = promoCodeData?.target || 'ALL'
      if (promoCodeData && promoCodeData.isActive && promoCodeData.currentUses < promoCodeData.maxUses) {
        const now = new Date()
        const nowJakarta = toJakarta(now)
        const fromJakarta = toJakarta(new Date(promoCodeData.validFrom))
        const untilJakarta = toJakarta(new Date(promoCodeData.validUntil))

        if (nowJakarta >= fromJakarta && nowJakarta <= untilJakarta) {
          const hasMerch = merchandise && Array.isArray(merchandise) && merchandise.length > 0

          // Validate minimum requirements
          if (seatCodes.length < (promoCodeData.minTickets || 0)) {
            return NextResponse.json({ error: `Promo ini berlaku untuk pembelian minimal ${promoCodeData.minTickets} tiket` }, { status: 400 })
          }
          if (!hasMerch && (promoCodeData.minMerchItems || 0) > 0) {
            return NextResponse.json({ error: `Promo ini berlaku jika membeli minimal ${promoCodeData.minMerchItems} merchandise` }, { status: 400 })
          }

          // Validate target requirements
          if (promoTarget === 'BUNDLING' && !(seatCodes.length > 0 && hasMerch)) {
            return NextResponse.json({ error: 'Promo bundling hanya berlaku jika membeli tiket + merchandise' }, { status: 400 })
          }
          if (promoTarget === 'MERCH' && !hasMerch) {
            return NextResponse.json({ error: 'Promo ini hanya berlaku untuk merchandise' }, { status: 400 })
          }

          // Calculate discount based on target and isPerItem
          // Note: merchTotal will be calculated below, so for TICKET target, use seatTotal only
          // For MERCH/BUNDLING/ALL, discount will be recalculated after merch processing
          const ticketSubtotal = seatTotal + adminFeeTotal
          const isPerItem = promoCodeData.isPerItem === true

          if (promoTarget === 'TICKET') {
            // Discount applies to ticket subtotal only
            if (isPerItem) {
              // Per-item: discount × number of tickets
              const perItemDiscount =
                promoCodeData.discountType === 'PERCENT'
                  ? Math.round((ticketSubtotal / seatCodes.length) * promoCodeData.discountValue / 100)
                  : Math.min(promoCodeData.discountValue, ticketSubtotal / seatCodes.length)
              discountAmount = perItemDiscount * seatCodes.length
            } else {
              discountAmount =
                promoCodeData.discountType === 'PERCENT'
                  ? Math.round(ticketSubtotal * promoCodeData.discountValue / 100)
                  : Math.min(promoCodeData.discountValue, ticketSubtotal)
            }
          }
          // For MERCH, BUNDLING, ALL — discount will be calculated after merchandise processing
        }
      }
    }

    // Merchandise - use DB price, not client-sent price
    let merchDataToSave: any = null
    if (merchandise && Array.isArray(merchandise) && merchandise.length > 0) {
      merchDataToSave = []
      let merchTotal = 0

      for (const merch of merchandise) {
        // Look up in DB for authoritative price & stock
        const merchItem = await db.merchandise.findUnique({ where: { id: merch.merchandiseId } })
        if (!merchItem) {
          return NextResponse.json({ error: 'Merchandise "' + merch.name + '" tidak ditemukan' }, { status: 404 })
        }
        if (merchItem.stock < merch.quantity || merch.quantity < 1) {
          return NextResponse.json({ error: 'Stok "' + merchItem.name + '" tidak cukup (sisa: ' + merchItem.stock + ')' }, { status: 409 })
        }

        const subtotal = merchItem.price * merch.quantity  // Use DB price
        merchTotal += subtotal

        merchDataToSave.push({
          merchandiseId: merch.merchandiseId,
          name: merchItem.name,
          price: merchItem.price,
          quantity: merch.quantity,
        })

        items.push({
          id: 'MERCH-' + merch.merchandiseId,
          price: merchItem.price,
          quantity: merch.quantity,
          name: merchItem.name,
          category: 'Merchandise',
        })
      }

      // Deduct stock AFTER all items verified (avoid partial deduction)
      for (const merch of merchandise) {
        await db.merchandise.update({
          where: { id: merch.merchandiseId },
          data: { stock: { decrement: merch.quantity } },
        })
      }

      // Recalculate discount for MERCH/BUNDLING/ALL targets now that we have merch total
      if (promoCodeData && discountAmount >= 0 && (promoTarget === 'ALL' || promoTarget === 'MERCH' || promoTarget === 'BUNDLING')) {
        const isPerItem = promoCodeData.isPerItem === true
        let targetSubtotal = 0

        if (promoTarget === 'MERCH') {
          targetSubtotal = merchTotal
        } else if (promoTarget === 'BUNDLING') {
          targetSubtotal = seatTotal + adminFeeTotal + merchTotal
        } else {
          // ALL
          targetSubtotal = seatTotal + adminFeeTotal + merchTotal
        }

        if (isPerItem) {
          // Per-item discount
          const totalItems = seatCodes.length + (merchandise || []).reduce((s: number, m: any) => s + m.quantity, 0)
          const perItemDiscount =
            promoCodeData.discountType === 'PERCENT'
              ? Math.round((targetSubtotal / Math.max(totalItems, 1)) * promoCodeData.discountValue / 100)
              : Math.min(promoCodeData.discountValue, targetSubtotal / Math.max(totalItems, 1))
          discountAmount = perItemDiscount * totalItems
        } else {
          discountAmount =
            promoCodeData.discountType === 'PERCENT'
              ? Math.round(targetSubtotal * promoCodeData.discountValue / 100)
              : Math.min(promoCodeData.discountValue, targetSubtotal)
        }
      }
    }

    const merchTotalCalc = merchDataToSave ? merchDataToSave.reduce((s: number, m: any) => s + m.price * m.quantity, 0) : 0

    // Final total = seats + admin fee + merch - discount
    const totalAmount = Math.max(seatTotal + adminFeeTotal + merchTotalCalc - discountAmount, 1)

    console.log('[checkout] seatTotal:', seatTotal, 'adminFee:', adminFeeTotal, 'discount:', discountAmount, 'merchTotal:', merchTotalCalc, 'totalAmount:', totalAmount)

    // Increment promo code usage whenever promoCodeId is provided
    // This prevents double-use even if server-side validation differs from client
    if (promoCodeId) {
      try {
        await db.promoCode.update({
          where: { id: promoCodeId },
          data: { currentUses: { increment: 1 } },
        })
        console.log('[checkout] Promo code usage incremented for', promoCodeId)
      } catch (promoErr) {
        console.error('[checkout] Failed to increment promo usage:', promoErr)
      }
    }

    // Generate transaction
    const tid = 'TRX-' + randomUUID().slice(0, 8).toUpperCase()

    await db.transaction.create({
      data: {
        transactionId: tid,
        eventId,
        showDateId: showDateId || null,
        customerName,
        customerEmail,
        customerWa,
        seatCodes: JSON.stringify(seatCodes),
        totalAmount,
        paymentStatus: 'PENDING',
        adminFeeApplied: adminFeeTotal,
        promoCodeId: discountAmount > 0 ? promoCodeId : null,
        merchandiseData: merchDataToSave ? JSON.stringify(merchDataToSave) : null,
      },
    })

    // HARD LOCK: Upgrade the seat lock from the session (CK:...) to the actual transaction (CK:TRX-...)
    // This absolutely prevents a duplicated tab (sharing the same sessionId) from 
    // generating a second transaction for the same seats!
    await db.seat.updateMany({
      where: { eventId, seatCode: { in: seatCodes }, lockedBy: checkoutId },
      data: { lockedBy: 'CK:TRX-' + tid },
    })

    // Midtrans Snap - use finalTotal as gross_amount
    // DO NOT send item_details when discount is applied to avoid mismatch
    // Midtrans validates sum(item_details) === gross_amount; if mismatch, it may override
    const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    if (!serverKey) {
      console.error('[checkout] MIDTRANS_SERVER_KEY is not configured in .env')
      return NextResponse.json(
        { error: 'Payment gateway belum dikonfigurasi. Hubungi admin untuk mengatur API key Midtrans.' },
        { status: 503 }
      )
    }
    const auth = Buffer.from(serverKey + ':').toString('base64')
    const snapUrl = 'https://app.sandbox.midtrans.com/snap/v1/transactions'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const snapPayload: any = {
      transaction_details: { order_id: tid, gross_amount: totalAmount },
      customer_details: { first_name: customerName, email: customerEmail, phone: customerWa },
      callbacks: { finish: appUrl + '/verify/' + tid },
    }

    // Only include item_details when there's no discount (items sum matches gross_amount)
    if (discountAmount === 0) {
      snapPayload.item_details = items
    } else {
      // With discount: send single summary item so display matches gross_amount
      const itemNames: string[] = []
      for (const item of items) {
        if (item.category !== 'Biaya') {
          itemNames.push(item.name)
        }
      }
      snapPayload.item_details = [
        {
          id: 'SUMMARY',
          price: totalAmount,
          quantity: 1,
          name: seatCodes.length + ' Tiket' + (merchDataToSave ? ' + Merchandise' : ''),
          category: 'Tiket Teateran',
        },
      ]
    }

    console.log('[checkout] Midtrans payload:', JSON.stringify(snapPayload, null, 2))

    const snapRes = await fetch(snapUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Basic ' + auth },
      body: JSON.stringify(snapPayload),
    })

    if (!snapRes.ok) {
      const errText = await snapRes.text().catch(() => 'Unknown error')
      console.error('[checkout] Midtrans error:', snapRes.status, errText)
      return NextResponse.json({ error: 'Gagal menghubungi payment gateway (error ' + snapRes.status + ')' }, { status: 502 })
    }

    const snapData = await snapRes.json()
    return NextResponse.json({ snapToken: snapData.token, transactionId: tid, redirectUrl: snapData.redirect_url })
  } catch (error) {
    console.error('[checkout] Fatal error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server. Coba lagi.' }, { status: 500 })
  }
}
