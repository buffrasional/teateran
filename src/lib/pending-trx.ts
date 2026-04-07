const STORAGE_KEY = 'tr_pending_trx'

interface PendingTrx {
  transactionId: string
  expiresAt: number
}

export function savePendingTrx(transactionId: string, expiresAt: Date): void {
  if (typeof window === 'undefined') return
  const data: PendingTrx = {
    transactionId,
    expiresAt: expiresAt.getTime(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getPendingTrx(): PendingTrx | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data: PendingTrx = JSON.parse(raw)
    // Check expiry
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function clearPendingTrx(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
