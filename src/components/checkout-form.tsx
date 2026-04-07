'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { Loader2, ArrowLeft, CreditCard, User, Mail, Phone, ShoppingBag, Ticket, Percent, X, Minus, Plus, Tag } from 'lucide-react'
import { savePendingTrx } from '@/lib/pending-trx'
import { getSessionId } from '@/lib/session-id'

interface SelectedSeat {
  id: string
  seatCode: string
  priceCategory: {
    id: string
    name: string
    price: number
    colorCode: string
  } | null
}

interface MerchItem {
  id: string
  name: string
  description: string
  price: number
  stock: number
  imageUrl: string | null
  quantity: number // cart quantity (client-side)
}

interface AppliedPromo {
  id: string
  code: string
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
  target: string
  isPerItem: boolean
}

interface CheckoutFormProps {
  eventId: string
  showDateId?: string | null
  selectedSeats: SelectedSeat[]
  totalPrice: number
  onBack: () => void
  adminFee?: number
}

declare global {
  interface Window {
    snap: {
      pay: (token: string, callbacks: {
        onSuccess?: (result: any) => void
        onPending?: (result: any) => void
        onError?: (result: any) => void
        onClose?: () => void
      }) => void
    }
  }
}

export function CheckoutForm({ eventId, showDateId, selectedSeats, totalPrice, onBack, adminFee = 0 }: CheckoutFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerWa: '',
  })
  const [error, setError] = useState<string | null>(null)

  // Merchandise state
  const [merchandise, setMerchandise] = useState<MerchItem[]>([])
  const [merchLoading, setMerchLoading] = useState(true)
  const [merchDialogOpen, setMerchDialogOpen] = useState(false)
  const [selectedMerchId, setSelectedMerchId] = useState<string | null>(null)

  // Derive live merch item from array (fixes stale quantity in dialog)
  const liveMerchItem = selectedMerchId ? merchandise.find((m) => m.id === selectedMerchId) || null : null

  // Promo code state
  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)

  const sessionId = getSessionId()
  const seatCodes = selectedSeats.map((s) => s.seatCode)

  // Fetch merchandise for this event
  useEffect(() => {
    async function fetchMerch() {
      try {
        const res = await fetch(`/api/merchandise?eventId=${eventId}`)
        if (res.ok) {
          const data = await res.json()
          setMerchandise((data.merchandise || []).map((m: any) => ({ ...m, quantity: 0 })))
        } else {
          console.warn('[checkout] Merchandise fetch failed:', res.status)
        }
      } catch (err) {
        console.warn('[checkout] Merchandise fetch error:', err)
      } finally {
        setMerchLoading(false)
      }
    }
    fetchMerch()
  }, [eventId])

  // Fetch admin fee from event if not provided
  const [eventAdminFee, setEventAdminFee] = useState(adminFee)
  useEffect(() => {
    if (adminFee > 0) return
    async function fetchEvent() {
      try {
        const res = await fetch(`/api/events/${eventId}`)
        if (res.ok) {
          const data = await res.json()
          setEventAdminFee(data.adminFee || 0)
        }
      } catch {}
    }
    fetchEvent()
  }, [eventId, adminFee])

  // === ALL CALCULATIONS (must use resolved admin fee) ===
  const seatTotal = totalPrice
  const resolvedAdminFee = adminFee > 0 ? adminFee : eventAdminFee
  const effectiveAdminFee = resolvedAdminFee * seatCodes.length
  const merchSubtotal = merchandise.reduce((sum, m) => sum + m.price * m.quantity, 0)
  const totalBeforeDiscount = seatTotal + effectiveAdminFee + merchSubtotal

  // Calculate discount matching server-side logic in /api/checkout
  let discountAmount = 0
  let discountLabel = ''

  if (appliedPromo) {
    const ticketSubtotal = seatTotal + effectiveAdminFee
    const { target = 'ALL', isPerItem = false, discountType, discountValue } = appliedPromo

    if (target === 'TICKET') {
      if (isPerItem && seatCodes.length > 0) {
        const perItemDiscount =
          discountType === 'PERCENT'
            ? Math.round((ticketSubtotal / seatCodes.length) * discountValue / 100)
            : Math.min(discountValue, ticketSubtotal / seatCodes.length)
        discountAmount = perItemDiscount * seatCodes.length
        discountLabel = `Rp ${perItemDiscount.toLocaleString('id-ID')}/tiket × ${seatCodes.length} tiket`
      } else {
        discountAmount =
          discountType === 'PERCENT'
            ? Math.round(ticketSubtotal * discountValue / 100)
            : Math.min(discountValue, ticketSubtotal)
        discountLabel = ''
      }
    } else if (target === 'MERCH' && merchSubtotal > 0) {
      const totalMerchQty = merchandise.filter(m => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)
      if (isPerItem && totalMerchQty > 0) {
        const perItemDiscount =
          discountType === 'PERCENT'
            ? Math.round((merchSubtotal / totalMerchQty) * discountValue / 100)
            : Math.min(discountValue, merchSubtotal / totalMerchQty)
        discountAmount = perItemDiscount * totalMerchQty
      } else {
        discountAmount =
          discountType === 'PERCENT'
            ? Math.round(merchSubtotal * discountValue / 100)
            : Math.min(discountValue, merchSubtotal)
      }
    } else if (target === 'BUNDLING' || target === 'ALL') {
      const totalItems = seatCodes.length + merchandise.filter(m => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)
      if (isPerItem && totalItems > 0) {
        const perItemDiscount =
          discountType === 'PERCENT'
            ? Math.round((totalBeforeDiscount / totalItems) * discountValue / 100)
            : Math.min(discountValue, totalBeforeDiscount / totalItems)
        discountAmount = perItemDiscount * totalItems
      } else {
        discountAmount =
          discountType === 'PERCENT'
            ? Math.round(totalBeforeDiscount * discountValue / 100)
            : Math.min(discountValue, totalBeforeDiscount)
      }
    }
  }

  const grandTotal = Math.max(totalBeforeDiscount - discountAmount, 0)

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  // Promo code application
  async function handleApplyPromo() {
    if (!promoInput.trim()) return
    setPromoLoading(true)
    setPromoError(null)
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoInput.trim(),
          eventId,
          seatCount: seatCodes.length,
          hasMerchandise: merchandise.some((m) => m.quantity > 0),
        }),
      })
      const data = await res.json()
      if (data.valid) {
        setAppliedPromo({ id: data.id, code: data.code, discountType: data.discountType, discountValue: data.discountValue, target: data.target || 'ALL', isPerItem: data.isPerItem || false })
        setPromoError(null)
      } else {
        setPromoError(data.error || 'Kode promo tidak valid')
        setAppliedPromo(null)
      }
    } catch {
      setPromoError('Gagal memvalidasi kode promo')
    } finally {
      setPromoLoading(false)
    }
  }

  function handleRemovePromo() {
    setAppliedPromo(null)
    setPromoInput('')
    setPromoError(null)
  }

  // Merchandise quantity controls
  function updateMerchQty(id: string, delta: number) {
    setMerchandise((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m
        const newQty = Math.max(0, Math.min(m.quantity + delta, m.stock))
        return { ...m, quantity: newQty }
      })
    )
  }

  const openSnapPopup = (token: string, transactionId: string) => {
    // Helper: unlock seats on error so user can retry
    const releaseOnFailure = () => {
      fetch('/api/seats/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, seatCodes, sessionId, showDateId: showDateId || undefined }),
      }).catch(() => {})
    }

    if (typeof window !== 'undefined' && window.snap) {
      window.snap.pay(token, {
        onSuccess: () => router.push('/verify/' + transactionId),
        onPending: () => router.push('/verify/' + transactionId),
        onError: () => { setError('Pembayaran gagal. Coba lagi.'); setIsLoading(false); releaseOnFailure() },
        onClose: () => { setIsLoading(false); releaseOnFailure() },
      })
    } else {
      let attempts = 0
      const waitForSnap = setInterval(() => {
        attempts++
        if (typeof window !== 'undefined' && window.snap) {
          clearInterval(waitForSnap)
          window.snap.pay(token, {
            onSuccess: () => router.push('/verify/' + transactionId),
            onPending: () => router.push('/verify/' + transactionId),
            onError: () => { setError('Pembayaran gagal'); setIsLoading(false); releaseOnFailure() },
            onClose: () => { setIsLoading(false); releaseOnFailure() },
          })
        } else if (attempts > 50) {
          clearInterval(waitForSnap)
          setError('Payment gateway tidak tersedia. Refresh halaman.')
          setIsLoading(false)
          releaseOnFailure()
        }
      }, 200)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!formData.customerName.trim()) { setError('Nama lengkap harus diisi'); setIsLoading(false); return }
    if (!formData.customerEmail.trim() || !formData.customerEmail.includes('@')) { setError('Email harus valid'); setIsLoading(false); return }
    if (!formData.customerWa.trim()) { setError('Nomor WhatsApp harus diisi'); setIsLoading(false); return }

    try {
      // Gate 2: Atomic checkout lock
      const confirmRes = await fetch('/api/seats/confirm-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, seatCodes, sessionId, showDateId: showDateId || undefined }),
      })

      if (!confirmRes.ok) {
        try { const errData = await confirmRes.json(); setError(errData.error || 'Gagal mengunci kursi') } catch { setError('Gagal mengunci kursi') }
        setIsLoading(false); return
      }
      const confirmData = await confirmRes.json()
      if (!confirmData.ok || confirmData.takenSeats?.length > 0) {
        const taken = confirmData.takenSeats?.join(', ') || seatCodes.join(', ')
        setError(`Kursi ${taken} sudah diamankan orang lain.`)
        setIsLoading(false); return
      }

      // Build checkout payload
      const selectedMerch = merchandise
        .filter((m) => m.quantity > 0)
        .map((m) => ({ merchandiseId: m.id, name: m.name, price: m.price, quantity: m.quantity }))

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          showDateId: showDateId || undefined,
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerWa: formData.customerWa.startsWith('+') ? formData.customerWa : '+62' + formData.customerWa,
          seatCodes,
          sessionId,
          promoCodeId: appliedPromo?.id || null,
          merchandise: selectedMerch.length > 0 ? selectedMerch : undefined,
        }),
      })

      if (!res.ok) {
        let msg = 'Gagal membuat transaksi'
        try { const errData = await res.json(); msg = errData.error || msg } catch {}
        setError(msg); setIsLoading(false); return
      }

      const data = await res.json()
      if (!data.snapToken) { setError('Gagal mendapatkan token pembayaran'); setIsLoading(false); return }

      savePendingTrx(data.transactionId, new Date(Date.now() + 10 * 60 * 1000))
      openSnapPopup(data.snapToken, data.transactionId)
    } catch (err) {
      console.error('Checkout error:', err)
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setIsLoading(false)
    }
  }

  const finalTotal = grandTotal

  return (
    <div className="mt-8 animate-fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-charcoal transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Pilih Kursi
      </button>

      <Card className="border-gold/20">
        <CardHeader>
          <CardTitle className="font-serif text-lg text-charcoal flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-gold" />
            Detail Pembayaran
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Order Summary */}
            <div className="bg-warm-white rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-semibold text-charcoal">Ringkasan Pesanan</h4>
              {selectedSeats.map((seat) => (
                <div key={seat.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Kursi {seat.seatCode}
                    {seat.priceCategory && <span className="text-xs ml-1">({seat.priceCategory.name})</span>}
                  </span>
                  <span className="text-charcoal">Rp {(seat.priceCategory?.price || 0).toLocaleString('id-ID')}</span>
                </div>
              ))}

              {/* Admin Fee */}
              {effectiveAdminFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Biaya Admin ({seatCodes.length} tiket)</span>
                  <span className="text-charcoal">Rp {effectiveAdminFee.toLocaleString('id-ID')}</span>
                </div>
              )}

              {/* Merchandise line items */}
              {merchandise.filter((m) => m.quantity > 0).map((m) => (
                <div key={m.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    <ShoppingBag className="w-3 h-3 inline mr-1" />
                    {m.name} x{m.quantity}
                  </span>
                  <span className="text-charcoal">Rp {(m.price * m.quantity).toLocaleString('id-ID')}</span>
                </div>
              ))}

              {/* Discount */}
              {discountAmount > 0 && (
                <div className="space-y-0.5">
                  <div className="flex justify-between text-sm text-success font-medium">
                    <span>
                      <Tag className="w-3 h-3 inline mr-1" />
                      Diskon ({appliedPromo?.code})
                    </span>
                    <span>- Rp {discountAmount.toLocaleString('id-ID')}</span>
                  </div>
                  {discountLabel && (
                    <p className="text-[10px] text-success/60 pl-4">{discountLabel}</p>
                  )}
                </div>
              )}

              <Separator className="my-2" />
              <div className="flex justify-between font-semibold text-charcoal">
                <span>Total</span>
                <span className="text-gold text-lg">Rp {finalTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Merchandise Add-ons */}
            {!merchLoading && merchandise.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-charcoal flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-gold" />
                  Add-ons / Merchandise
                </h4>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {merchandise.map((item) => {
                    const isSoldOut = item.stock === 0
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={isSoldOut}
                        onClick={() => {
                          if (!isSoldOut) {
                            setSelectedMerchId(item.id)
                            setMerchDialogOpen(true)
                          }
                        }}
                        className={`relative flex-shrink-0 w-24 h-24 rounded-lg border-2 overflow-hidden transition-all ${
                          isSoldOut
                            ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-100'
                            : item.quantity > 0
                              ? 'border-gold bg-gold/5 cursor-pointer hover:shadow-md'
                              : 'border-border bg-white cursor-pointer hover:border-gold/50 hover:shadow-md'
                        }`}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-charcoal/5">
                            <ShoppingBag className="w-6 h-6 text-charcoal/30" />
                          </div>
                        )}
                        {isSoldOut && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-white bg-danger px-1 rounded">HABIS</span>
                          </div>
                        )}
                        {item.quantity > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gold text-charcoal rounded-full flex items-center justify-center text-xs font-bold">
                            {item.quantity}
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                          <p className="text-[8px] text-white truncate">{item.name}</p>
                          <p className="text-[8px] text-gold font-semibold">Rp {item.price.toLocaleString('id-ID')}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Promo Code */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-charcoal flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" />
                Gunakan Kode Promo
              </Label>
              {appliedPromo ? (
                <div className="flex items-center justify-between bg-gold/10 border border-gold/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gold" />
                    <span className="text-sm font-mono font-semibold text-gold">{appliedPromo.code}</span>
                    <Badge variant="secondary" className="text-xs">
                      {appliedPromo.discountType === 'PERCENT' ? `${appliedPromo.discountValue}%` : `Rp ${appliedPromo.discountValue.toLocaleString('id-ID')}`}
                    </Badge>
                  </div>
                  <button type="button" onClick={handleRemovePromo} className="text-danger hover:text-danger/80">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Masukkan kode promo"
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null) }}
                    className="bg-white flex-1 font-mono uppercase"
                    disabled={promoLoading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoInput.trim()}
                    className="shrink-0"
                  >
                    {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Terapkan'}
                  </Button>
                </div>
              )}
              {promoError && <p className="text-xs text-danger">{promoError}</p>}
            </div>

            {/* Customer Details */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-charcoal flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Nama Lengkap
                </Label>
                <Input id="name" placeholder="Masukkan nama lengkap" value={formData.customerName} onChange={(e) => handleChange('customerName', e.target.value)} required className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa" className="text-sm font-medium text-charcoal flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Nomor WhatsApp
                </Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">+62</span>
                  <Input id="wa" placeholder="8123456789" value={formData.customerWa} onChange={(e) => handleChange('customerWa', e.target.value)} required className="rounded-l-none bg-white" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-charcoal flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </Label>
                <Input id="email" type="email" placeholder="email@contoh.com" value={formData.customerEmail} onChange={(e) => handleChange('customerEmail', e.target.value)} required className="bg-white" />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-danger">{error}</div>
            )}

            {/* Submit */}
            <Button type="submit" disabled={isLoading} className="w-full bg-charcoal hover:bg-charcoal/90 text-gold font-semibold py-5 text-base">
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</>
              ) : (
                <><CreditCard className="w-4 h-4 mr-2" />Bayar Sekarang — Rp {finalTotal.toLocaleString('id-ID')}</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Merchandise Detail Dialog */}
      <Dialog open={merchDialogOpen} onOpenChange={(open) => { setMerchDialogOpen(open); if (!open) setSelectedMerchId(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">{liveMerchItem?.name}</DialogTitle>
            <DialogDescription>{liveMerchItem?.description || 'Merchandise eksklusif Teateran'}</DialogDescription>
          </DialogHeader>
          {liveMerchItem && (
            <div className="space-y-4">
              {liveMerchItem.imageUrl && (
                <div className="aspect-square rounded-lg overflow-hidden bg-charcoal/5 max-h-[35vh]">
                  <img src={liveMerchItem.imageUrl} alt={liveMerchItem.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gold">
                  Rp {liveMerchItem.price.toLocaleString('id-ID')}
                </span>
                <Badge variant="secondary" className="text-xs">
                  Stok: {liveMerchItem.stock}
                </Badge>
              </div>
              {liveMerchItem.description && liveMerchItem.imageUrl && (
                <p className="text-sm text-muted-foreground">{liveMerchItem.description}</p>
              )}
              <div className="flex items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => updateMerchQty(liveMerchItem.id, -1)}
                  disabled={liveMerchItem.quantity === 0}
                  className="h-10 w-10"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-2xl font-bold text-charcoal w-12 text-center">{liveMerchItem.quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => updateMerchQty(liveMerchItem.id, 1)}
                  disabled={liveMerchItem.quantity >= liveMerchItem.stock}
                  className="h-10 w-10"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <Button
                type="button"
                onClick={() => { setMerchDialogOpen(false); setSelectedMerchId(null) }}
                className="w-full bg-charcoal hover:bg-charcoal/90 text-gold"
              >
                {liveMerchItem.quantity > 0
                  ? `Tambah ${liveMerchItem.quantity} ke Pesanan`
                  : 'Pilih Jumlah'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
