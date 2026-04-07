'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { QrCode, RotateCcw, LogIn, ArrowLeft, Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

type ScanResultState = 'SCANNING' | 'LOADING' | 'SUCCESS' | 'WARNING' | 'ERROR'

interface CheckInTransaction {
  transactionId: string
  customerName: string
  customerEmail: string
  customerWa: string
  seatCodes: string
  paymentStatus: string
  checkInTime: string | null
  paidAt: string | null
  merchandiseData: string | null
  totalAmount: number
  eventTitle: string | null
}

interface ScanResult {
  status: 'SUCCESS' | 'WARNING' | 'ERROR'
  message: string
  transaction?: CheckInTransaction
}

export default function UsherScannerPage() {
  const [scanState, setScanState] = useState<ScanResultState>('SCANNING')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null)
  const scannerRef = useRef<any>(null)
  const scannerContainerRef = useRef<HTMLDivElement>(null)

  // Parse merchandise data from JSON string
  function parseMerchandise(data: string | null): Array<{ name: string; quantity: number }> {
    if (!data) return []
    try {
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  // Parse seat codes from JSON string
  function parseSeatCodes(codes: string | null): string[] {
    if (!codes) return []
    try {
      return JSON.parse(codes)
    } catch {
      return codes.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }

  // Extract transactionId from QR text
  // Format: "NAMA: {name} | KURSI: {seatCodes} | KODE TRX: {transactionId}"
  function extractTransactionId(qrText: string): string | null {
    const parts = qrText.split('KODE TRX:')
    if (parts.length < 2) return null
    return parts[1].trim()
  }

  // Start check-in
  async function performCheckIn(transactionId: string) {
    setScanState('LOADING')
    setLastTransactionId(transactionId)

    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      })

      const data = await res.json()

      if (data.status === 'SUCCESS') {
        setScanState('SUCCESS')
      } else if (data.status === 'WARNING') {
        setScanState('WARNING')
      } else {
        setScanState('ERROR')
      }

      setResult(data)
    } catch (err) {
      setScanState('ERROR')
      setResult({
        status: 'ERROR',
        message: 'Gagal terhubung ke server. Silakan coba lagi.',
      })
    }
  }

  // Handle QR scan success
  function handleScanSuccess(decodedText: string) {
    const transactionId = extractTransactionId(decodedText)
    if (!transactionId) {
      setScanState('ERROR')
      setResult({
        status: 'ERROR',
        message: 'Format QR tidak valid. Pastikan QR tiket yang benar.',
      })
      return
    }

    // Stop scanner during check-in
    stopScanner()
    performCheckIn(transactionId)
  }

  // Start scanner
  async function startScanner() {
    // Stop existing scanner if any
    await stopScanner()

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          handleScanSuccess(decodedText)
        },
        () => {
          // QR not found in frame - ignore
        }
      )

      scannerRef.current = scanner
      setScanState('SCANNING')
    } catch (err) {
      console.error('Failed to start scanner:', err)
      setScanState('ERROR')
      setResult({
        status: 'ERROR',
        message: 'Gagal mengakses kamera. Pastikan izin kamera diberikan.',
      })
    }
  }

  // Stop scanner
  async function stopScanner() {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === 2) { // SCANNING
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch {
        // ignore
      }
      scannerRef.current = null
    }
  }

  // Reset to scanning state
  function resetScanner() {
    setResult(null)
    setLastTransactionId(null)
    setScanState('SCANNING')
    // Re-mount scanner after a short delay
    setTimeout(() => {
      startScanner()
    }, 300)
  }

  // Check in again (idempotent)
  function handleCheckInAgain() {
    if (lastTransactionId) {
      performCheckIn(lastTransactionId)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    // Start scanner on mount
    const timer = setTimeout(() => {
      startScanner()
    }, 500)

    return () => {
      clearTimeout(timer)
      stopScanner()
    }
  }, [])

  // === RENDER ===

  // Loading state during check-in API call
  if (scanState === 'LOADING') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-white">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-charcoal animate-spin mx-auto" />
          <p className="text-charcoal font-medium text-lg">Memverifikasi tiket...</p>
        </div>
      </div>
    )
  }

  // Success state - green background
  if (scanState === 'SUCCESS' && result?.transaction) {
    const txn = result.transaction
    const seats = parseSeatCodes(txn.seatCodes)
    const merch = parseMerchandise(txn.merchandiseData)

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#4A7C59' }}>
        <div className="max-w-md w-full text-center text-white space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle className="w-14 h-14 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold font-serif">Tiket Valid ✓</h1>

          {/* Event */}
          {txn.eventTitle && (
            <p className="text-white/80 text-lg">{txn.eventTitle}</p>
          )}

          {/* Customer Info */}
          <div className="bg-white/15 rounded-xl p-5 space-y-3 text-left">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wider">Nama Pemesan</p>
              <p className="text-lg font-semibold">{txn.customerName}</p>
            </div>

            <div>
              <p className="text-white/60 text-xs uppercase tracking-wider">Kursi</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {seats.map((seat) => (
                  <span
                    key={seat}
                    className="bg-white/20 px-3 py-1 rounded-full text-sm font-mono font-medium"
                  >
                    {seat}
                  </span>
                ))}
              </div>
            </div>

            {merch.length > 0 && (
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider">Merchandise</p>
                <ul className="mt-1 space-y-1">
                  {merch.map((m, i) => (
                    <li key={i} className="text-sm text-white/90">
                      {m.name} × {m.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action Button */}
          <Button
            onClick={handleCheckInAgain}
            className="w-full min-h-[56px] text-lg font-semibold bg-white text-[#4A7C59] hover:bg-white/90 rounded-xl"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Check-In / Masuk
          </Button>

          <Button
            onClick={resetScanner}
            variant="ghost"
            className="w-full min-h-[44px] text-white/70 hover:text-white hover:bg-white/10 text-sm"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Scan Tiket Berikutnya
          </Button>
        </div>
      </div>
    )
  }

  // Warning state - yellow background (already scanned)
  if (scanState === 'WARNING' && result?.transaction) {
    const txn = result.transaction
    const seats = parseSeatCodes(txn.seatCodes)

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#D4843E' }}>
        <div className="max-w-md w-full text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-14 h-14 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold font-serif text-white">Peringatan</h1>
          <p className="text-white/90 text-lg font-medium">Tiket sudah di-scan</p>

          {/* Warning Details */}
          <div className="bg-white/15 rounded-xl p-5 space-y-3 text-left text-white">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wider">Waktu Scan Sebelumnya</p>
              <p className="text-lg font-semibold">{result.message}</p>
            </div>

            <div>
              <p className="text-white/60 text-xs uppercase tracking-wider">Nama Pemesan</p>
              <p className="text-lg font-semibold">{txn.customerName}</p>
            </div>

            <div>
              <p className="text-white/60 text-xs uppercase tracking-wider">Kursi</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {seats.map((seat) => (
                  <span
                    key={seat}
                    className="bg-white/20 px-3 py-1 rounded-full text-sm font-mono font-medium"
                  >
                    {seat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={resetScanner}
            className="w-full min-h-[56px] text-lg font-semibold bg-white hover:bg-white/90 rounded-xl"
            style={{ color: '#D4843E' }}
          >
            <QrCode className="w-5 h-5 mr-2" />
            Scan Tiket Berikutnya
          </Button>
        </div>
      </div>
    )
  }

  // Error state - red background
  if (scanState === 'ERROR') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: '#C75050' }}>
        <div className="max-w-md w-full text-center text-white space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
              <XCircle className="w-14 h-14 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold font-serif">Tiket Tidak Valid</h1>

          {/* Error Message */}
          <div className="bg-white/15 rounded-xl p-5">
            <p className="text-white/90 text-lg">{result?.message || 'Terjadi kesalahan saat memverifikasi tiket.'}</p>
          </div>

          {/* Action Button */}
          <Button
            onClick={resetScanner}
            className="w-full min-h-[56px] text-lg font-semibold bg-white hover:bg-white/90 rounded-xl"
            style={{ color: '#C75050' }}
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Scan Ulang
          </Button>
        </div>
      </div>
    )
  }

  // Scanning state - show QR scanner
  return (
    <div className="min-h-screen flex flex-col bg-warm-white">
      {/* Header */}
      <div className="bg-charcoal text-white px-4 py-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-white/10 h-11 w-11"
          onClick={async () => {
            await stopScanner()
            window.history.back()
          }}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-serif text-lg font-semibold">Scanner Tiket</h1>
          <p className="text-white/50 text-xs">Arahkan QR Code ke kamera</p>
        </div>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Scanner Container */}
          <div
            ref={scannerContainerRef}
            id="qr-reader"
            className="rounded-2xl overflow-hidden shadow-lg border-2 border-charcoal/20"
            style={{ minHeight: '320px' }}
          />

          {/* Instructions */}
          <div className="mt-6 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-charcoal/70">
              <QrCode className="w-5 h-5" />
              <p className="text-sm font-medium">Menunggu QR Code...</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Pastikan QR Code berada dalam bingkai scanner
            </p>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-4 border-t border-border/50">
        <p className="text-center text-xs text-muted-foreground">
          QR Format: NAMA: ... | KURSI: ... | KODE TRX: ...
        </p>
      </div>
    </div>
  )
}
