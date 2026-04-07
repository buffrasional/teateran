'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShoppingBag, Loader2, Filter, User, Mail, Phone, Tag, Hash, Calendar, Search } from 'lucide-react'

interface MerchOrder {
  transactionId: string
  customerName: string
  customerEmail: string
  customerWa: string
  seatCodes: string
  eventTitle: string
  eventDate: string
  merchandiseId: string
  merchName: string
  merchPrice: number
  merchQty: number
  merchSubtotal: number
  totalAmount: number
  paidAt: string
  eventId: string
}

interface EventOption {
  id: string
  title: string
}

export default function UsherMerchandisePage() {
  const [orders, setOrders] = useState<MerchOrder[]>([])
  const [events, setEvents] = useState<EventOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterEventId, setFilterEventId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTrx, setExpandedTrx] = useState<string | null>(null)

  // Fetch events for filter
  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('/api/events?published=true')
        if (res.ok) {
          const data = await res.json()
          setEvents((data.events || []).map((e: any) => ({ id: e.id, title: e.title })))
        }
      } catch {}
    }
    fetchEvents()
  }, [])

  // Fetch merchandise orders
  useEffect(() => {
    async function fetchOrders() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (filterEventId) params.set('eventId', filterEventId)
        const res = await fetch('/api/usher/merchandise?' + params.toString())
        if (res.ok) {
          const data = await res.json()
          setOrders(data.orders || [])
        }
      } catch {} finally {
        setIsLoading(false)
      }
    }
    fetchOrders()
  }, [filterEventId])

  // Group orders by transactionId
  const grouped = orders.reduce<Record<string, MerchOrder[]>>((acc, order) => {
    if (!acc[order.transactionId]) acc[order.transactionId] = []
    acc[order.transactionId].push(order)
    return acc
  }, {})

  // Filter by search
  const filteredGroups = Object.entries(grouped).filter(([, items]) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return items.some(
      (item) =>
        item.customerName.toLowerCase().includes(q) ||
        item.customerEmail.toLowerCase().includes(q) ||
        item.transactionId.toLowerCase().includes(q) ||
        item.merchName.toLowerCase().includes(q)
    )
  })

  function formatDate(dateStr: string) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-gold animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Memuat data merchandise...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-serif text-xl font-bold text-charcoal flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-gold" />
          Merchandise Orders
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Daftar pesanan merchandise yang sudah dibayar — gunakan untuk klaim merch ke pembeli
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Event Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            value={filterEventId}
            onChange={(e) => setFilterEventId(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg border border-border bg-white text-sm appearance-none cursor-pointer min-w-[200px]"
          >
            <option value="">Semua Event</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cari nama, email, atau ID transaksi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-white text-sm"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <div className="bg-charcoal/5 rounded-lg px-4 py-2">
          <span className="text-muted-foreground">Total Pesanan: </span>
          <span className="font-bold text-charcoal">{Object.keys(grouped).length}</span>
        </div>
        <div className="bg-gold/10 rounded-lg px-4 py-2">
          <span className="text-muted-foreground">Total Items: </span>
          <span className="font-bold text-charcoal">{orders.length}</span>
        </div>
      </div>

      {/* Orders List */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">
            {searchQuery || filterEventId
              ? 'Tidak ada pesanan yang cocok dengan filter'
              : 'Belum ada pesanan merchandise'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(([trxId, items]) => {
            const first = items[0]
            const isExpanded = expandedTrx === trxId
            const totalMerch = items.reduce((s, i) => s + i.merchSubtotal, 0)

            return (
              <Card key={trxId} className="border-border/50 hover:border-gold/30 transition-colors">
                <CardContent className="p-4">
                  {/* Header — always visible */}
                  <button
                    onClick={() => setExpandedTrx(isExpanded ? null : trxId)}
                    className="w-full flex items-start justify-between gap-4 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-charcoal/80 text-white text-[10px] border-0">
                          {first.eventTitle}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(first.paidAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gold shrink-0" />
                        <span className="text-sm font-semibold text-charcoal truncate">
                          {first.customerName}
                        </span>
                      </div>
                      {/* Merch summary (collapsed) */}
                      <div className="flex items-center gap-2 mt-1">
                        <ShoppingBag className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">
                          {items.map((i) => `${i.merchName} x${i.merchQty}`).join(', ')}
                        </span>
                        <span className="text-xs font-semibold text-charcoal shrink-0">
                          — Rp {totalMerch.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-[10px] text-muted-foreground font-mono">{trxId}</span>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-3 animate-fade-in">
                      {/* Customer Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-gold shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Nama</p>
                            <p className="text-sm text-charcoal">{first.customerName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-gold shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Email</p>
                            <p className="text-sm text-charcoal break-all">{first.customerEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-gold shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">WhatsApp</p>
                            <p className="text-sm text-charcoal">{first.customerWa}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-gold shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Transaction ID</p>
                            <p className="text-sm text-charcoal font-mono">{trxId}</p>
                          </div>
                        </div>
                      </div>

                      {/* Seat Codes */}
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-gold shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase">Kursi</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {(() => {
                              try {
                                return JSON.parse(first.seatCodes || '[]').map((code: string) => (
                                  <Badge key={code} variant="secondary" className="text-[10px] bg-charcoal/10 text-charcoal px-2">
                                    {code}
                                  </Badge>
                                ))
                              } catch {
                                return null
                              }
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Merchandise Items Table */}
                      <div className="bg-gold/5 rounded-lg p-3">
                        <p className="text-[10px] text-gold-dark uppercase tracking-wider mb-2 font-semibold">
                          Detail Merchandise
                        </p>
                        <div className="space-y-2">
                          {items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4 text-gold" />
                                <span className="text-charcoal font-medium">{item.merchName}</span>
                                <Badge variant="secondary" className="text-[10px]">
                                  x{item.merchQty}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                  Rp {item.merchPrice.toLocaleString('id-ID')}/pcs
                                </p>
                                <p className="text-sm font-semibold text-charcoal">
                                  Rp {item.merchSubtotal.toLocaleString('id-ID')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 pt-2 border-t border-gold/20 flex justify-between text-sm">
                          <span className="font-medium text-gold-dark">Subtotal Merchandise</span>
                          <span className="font-bold text-charcoal">
                            Rp {totalMerch.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Pembayaran</span>
                        <span className="font-bold text-gold text-lg">
                          Rp {first.totalAmount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
