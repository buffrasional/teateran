import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { transactionId, amount, customerName, customerEmail, customerWa, itemDetails } = body

    const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
    const authString = Buffer.from(serverKey + ':').toString('base64')
    const isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const url = isProd ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Basic ' + authString },
      body: JSON.stringify({
        transaction_details: { order_id: transactionId, gross_amount: amount },
        item_details: itemDetails || [],
        customer_details: { first_name: customerName, email: customerEmail, phone: customerWa },
        callbacks: { finish: appUrl + '/verify/' + transactionId },
      }),
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[snap]', error)
    return NextResponse.json({ error: 'Snap token failed' }, { status: 500 })
  }
}
