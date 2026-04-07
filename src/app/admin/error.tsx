'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Admin Error Boundary] Caught:', error)
  }, [error])

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="font-serif text-lg font-bold text-red-800 mb-2">
            Terjadi Error
          </h2>
          <p className="text-sm text-red-600 mb-4">
            Halaman admin mengalami error. Silakan coba lagi atau hubungi developer.
          </p>
          <div className="bg-white rounded-lg p-4 text-left mb-4 border border-red-100">
            <p className="text-xs font-mono text-red-800 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-[10px] text-red-400 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => {
                // Clear all caches and reload
                if ('caches' in window) {
                  caches.keys().then(names => names.forEach(name => caches.delete(name)))
                }
                window.location.href = '/admin'
              }}
              className="px-4 py-2 bg-white text-red-600 rounded-lg text-sm font-medium border border-red-200 hover:bg-red-50 transition-colors"
            >
              Kembali ke Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
