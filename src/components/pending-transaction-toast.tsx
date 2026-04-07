'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { getPendingTrx, clearPendingTrx } from '@/lib/pending-trx'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X } from 'lucide-react'

const STORAGE_KEY = 'tr_pending_trx'

function subscribeToStorage(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function getServerSnapshot() {
  return null
}

export function PendingTransactionToast() {
  const pathname = usePathname()
  const storageValue = useSyncExternalStore(subscribeToStorage, getSnapshot, getServerSnapshot)

  // Parse the pending transaction from storage
  const pending = storageValue ? (() => {
    try {
      const data = JSON.parse(storageValue)
      if (Date.now() > data.expiresAt) return null
      return data
    } catch {
      return null
    }
  })() : null

  // Don't show on checkout/verify/admin pages
  const isHiddenPath =
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/admin')

  const transactionId = pending?.transactionId ?? null
  const shouldShow = !isHiddenPath && !!transactionId

  const handleContinue = useCallback(() => {
    if (transactionId) {
      window.location.href = '/checkout/status/' + transactionId
    }
  }, [transactionId])

  const handleCancel = useCallback(() => {
    clearPendingTrx()
  }, [])

  if (!shouldShow) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-fade-in max-w-sm">
      <div className="bg-charcoal rounded-xl shadow-2xl border border-gold/20 overflow-hidden">
        {/* Content */}
        <div className="p-4 pr-10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-gold shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-cream/90 leading-snug">
                Kamu memiliki 1 transaksi pembayaran yang belum diselesaikan.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 pb-4">
          <Button
            onClick={handleContinue}
            size="sm"
            className="bg-gold hover:bg-gold/90 text-charcoal font-semibold text-xs px-4 h-8"
          >
            Lanjutkan Pembayaran
          </Button>
          <Button
            onClick={handleCancel}
            variant="ghost"
            size="sm"
            className="text-cream/50 hover:text-cream/80 hover:bg-white/5 text-xs h-8 px-3"
          >
            Batalkan
          </Button>
        </div>

        {/* Close button */}
        <button
          onClick={handleCancel}
          className="absolute top-2 right-2 text-cream/30 hover:text-cream/60 transition-colors p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
