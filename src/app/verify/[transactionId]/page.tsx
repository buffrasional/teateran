'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatEventDateTime } from '@/lib/date'
import { clearPendingTrx } from '@/lib/pending-trx'
import { Loader2, CheckCircle2, XCircle, Ticket, Calendar, MapPin, User, QrCode, ArrowLeft, RefreshCw } from 'lucide-react'

interface TransactionData {
  transactionId: string
  customerName: string
  customerEmail: string
  customerWa: string
  seatCodes: string
  totalAmount: number
  paymentStatus: string
  qrCodeUrl: string | null
  paidAt: string | null
  createdAt: string
  merchandiseData: string | null
  adminFeeApplied: number
  promoCodeId: string | null
  event: {
    title: string
    showDate: string
    location: string
  }
}

interface VerifyResponse {
  transaction: TransactionData
  justPaid?: boolean
  midtransStatus?: string
}

export default function VerifyPage() {
  const params = useParams()
  const transactionId = params.transactionId as string

  const [transaction, setTransaction] = useState<TransactionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTransaction = useCallback(async (showLoading = false) => {
    if (showLoading) setIsRefreshing(true)
    try {
      const res = await fetch('/api/verify/' + transactionId)
      if (!res.ok) {
        setError('Transaksi tidak ditemukan')
        setIsLoading(false)
        return null
      }
      const data: VerifyResponse = await res.json()
      setTransaction(data.transaction)
      return data
    } catch (err) {
      setError('Gagal memuat data transaksi')
      return null
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [transactionId])

  // Clear pending transaction if status is PAID
  useEffect(() => {
    if (transaction?.paymentStatus === 'PAID') {
      clearPendingTrx()
    }
  }, [transaction?.paymentStatus])

  // Initial fetch
  useEffect(() => {
    if (transactionId) {
      fetchTransaction().then((data) => {
        setIsLoading(false)
        // If pending, start polling
        if (data?.transaction?.paymentStatus === 'PENDING') {
          startPolling()
        }
        // Clear localStorage if already paid
        if (data?.transaction?.paymentStatus === 'PAID') {
          clearPendingTrx()
        }
      })
    }
    return () => stopPolling()
  }, [transactionId, fetchTransaction])

  const startPolling = useCallback(() => {
    stopPolling()
    pollIntervalRef.current = setInterval(async () => {
      const data = await fetchTransaction()
      if (data) {
        setPollCount((prev) => prev + 1)
        // Stop polling if no longer pending
        if (data.transaction.paymentStatus !== 'PENDING') {
          stopPolling()
        }
      }
    }, 3000) // Poll every 3 seconds
  }, [fetchTransaction])

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  // Stop polling when component unmounts
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const handleManualRefresh = async () => {
    await fetchTransaction(true)
  }

  const isPaid = transaction?.paymentStatus === 'PAID'
  const isPending = transaction?.paymentStatus === 'PENDING'
  const isExpired = transaction?.paymentStatus === 'EXPIRED'
  const isFailed = transaction?.paymentStatus === 'FAILED'
  const seatCodes = transaction?.seatCodes ? JSON.parse(transaction.seatCodes) : []
  const merchItems = transaction?.merchandiseData ? JSON.parse(transaction.merchandiseData) : []

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <Card className="w-full max-w-md text-center p-8">
            <XCircle className="w-16 h-16 text-danger mx-auto mb-4" />
            <h1 className="font-serif text-xl font-bold text-charcoal mb-2">Tiket Tidak Valid</h1>
            <p className="text-sm text-muted-foreground">{error || 'Transaksi tidak ditemukan'}</p>
            <p className="text-xs text-muted-foreground/50 mt-2">ID: {transactionId}</p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-warm-white">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Status Badge */}
          <div className="flex justify-center mb-6">
            {isPaid ? (
              <div className="animate-fade-in">
                <CheckCircle2 className="w-24 h-24 text-success mx-auto" />
                <h1 className="font-serif text-2xl font-bold text-success text-center mt-3">
                  TIKET VALID
                </h1>
                <p className="text-sm text-muted-foreground text-center mt-1">Pembayaran berhasil dikonfirmasi</p>
              </div>
            ) : isPending ? (
              <div className="animate-fade-in">
                <Loader2 className="w-24 h-24 text-gold mx-auto animate-spin" />
                <h1 className="font-serif text-2xl font-bold text-gold text-center mt-3">
                  MENUNGGU PEMBAYARAN
                </h1>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  Menunggu konfirmasi dari Midtrans...
                </p>
                {pollCount > 0 && (
                  <p className="text-xs text-muted-foreground/50 text-center mt-1">
                    Sudah mengecek {pollCount}x
                  </p>
                )}
              </div>
            ) : isExpired ? (
              <div className="animate-fade-in">
                <XCircle className="w-24 h-24 text-danger mx-auto" />
                <h1 className="font-serif text-2xl font-bold text-danger text-center mt-3">
                  PEMBAYARAN EXPIRED
                </h1>
                <p className="text-sm text-muted-foreground text-center mt-1">Batas waktu pembayaran telah habis</p>
              </div>
            ) : isFailed ? (
              <div className="animate-fade-in">
                <XCircle className="w-24 h-24 text-danger mx-auto" />
                <h1 className="font-serif text-2xl font-bold text-danger text-center mt-3">
                  PEMBAYARAN GAGAL
                </h1>
                <p className="text-sm text-muted-foreground text-center mt-1">Pembayaran tidak berhasil</p>
              </div>
            ) : (
              <div className="animate-fade-in">
                <XCircle className="w-24 h-24 text-danger mx-auto" />
                <h1 className="font-serif text-2xl font-bold text-danger text-center mt-3">
                  TIKET TIDAK VALID
                </h1>
              </div>
            )}
          </div>

          {/* Ticket Card */}
          <Card className="overflow-hidden border-gold/20">
            <div className="bg-charcoal p-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <Ticket className="w-4 h-4 text-gold" />
                <span className="text-gold text-xs tracking-widest uppercase">E-Ticket</span>
              </div>
              <h2 className="font-serif text-white text-lg font-semibold mt-1">
                {transaction.event.title}
              </h2>
            </div>

            <CardContent className="p-6 space-y-4">
              {/* Customer Info */}
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gold" />
                <div>
                  <p className="text-xs text-muted-foreground">Nama Pemesan</p>
                  <p className="text-sm font-semibold text-charcoal">{transaction.customerName}</p>
                </div>
              </div>

              {/* Event Details */}
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gold" />
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal Pertunjukan</p>
                  <p className="text-sm font-medium text-charcoal">
                    {formatEventDateTime(transaction.event.showDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-gold" />
                <div>
                  <p className="text-xs text-muted-foreground">Lokasi</p>
                  <p className="text-sm font-medium text-charcoal">{transaction.event.location}</p>
                </div>
              </div>

              {/* Seats */}
              <div className="bg-warm-white rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Nomor Kursi</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {seatCodes.map((code: string) => (
                    <Badge key={code} variant="secondary" className="bg-charcoal text-gold text-sm px-3 py-1 font-mono">
                      {code}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Merchandise */}
              {merchItems.length > 0 && (
                <div className="bg-gold/5 rounded-lg p-4">
                  <p className="text-xs text-gold-dark uppercase tracking-widest mb-2 text-center">Merchandise</p>
                  <div className="space-y-1.5">
                    {merchItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-charcoal">{item.name} <span className="text-muted-foreground">x{item.quantity}</span></span>
                        <span className="text-charcoal font-medium">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Total Pembayaran</p>
                <p className="font-serif text-xl font-bold text-gold">
                  Rp {transaction.totalAmount.toLocaleString('id-ID')}
                </p>
              </div>

              {/* QR Code — only show when PAID */}
              {isPaid && transaction.qrCodeUrl && (
                <div className="text-center pt-2 animate-fade-in">
                  <QrCode className="w-4 h-4 text-gold mx-auto mb-2" />
                  <img
                    src={transaction.qrCodeUrl}
                    alt="QR Code"
                    className="w-48 h-48 mx-auto rounded-lg border border-border"
                  />
                  <p className="text-[10px] text-muted-foreground/50 mt-2">
                    Transaction ID: {transaction.transactionId}
                  </p>
                </div>
              )}

              {/* Payment Status */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <Badge
                  variant="secondary"
                  className={
                    isPaid
                      ? 'bg-success/10 text-success'
                      : isPending
                      ? 'bg-gold/10 text-gold-dark'
                      : 'bg-danger/10 text-danger'
                  }
                >
                  {transaction.paymentStatus}
                </Badge>
                {isPending && (
                  <span className="text-xs text-muted-foreground/50 animate-pulse">
                    auto-refresh
                  </span>
                )}
              </div>

              {/* Manual Refresh Button */}
              <div className="flex justify-center pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="text-xs text-muted-foreground"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh Status
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pending notice */}
          {isPending && (
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground/70 bg-gold/5 rounded-lg px-4 py-3">
                Halaman ini otomatis mengecek status pembayaran setiap 3 detik.
                <br />
                Setelah pembayaran berhasil, e-tiket akan langsung muncul.
              </p>
            </div>
          )}

          <div className="text-center mt-6">
            <Button variant="ghost" size="sm" asChild>
              <a href="/">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Kembali ke Beranda
              </a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
