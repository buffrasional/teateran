import { db } from '@/lib/db'

export async function generateTransactionId(): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result: string
  let isUnique = false

  while (!isUnique) {
    let id = ''
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    result = `TRX-${id}`

    const existing = await db.transaction.findUnique({
      where: { transactionId: result! },
    })

    if (!existing) {
      isUnique = true
    }
  }

  return result!
}
