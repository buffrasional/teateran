'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Gift, Send, Loader2, Ticket, Users, X, MapPin, Clock, Mail, Phone,
  AlertCircle, CheckCircle2, XCircle, ChevronDown, ChevronUp, RotateCcw, Calendar, Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatShortDate, formatEventDateTime } from '@/lib/date'
import { parseLayoutData, type ParsedLayout } from '@/lib/seat-layout'
import { StageRenderer, ObjectsOverlay } from '@/lib/stage-renderer'
import { getSessionId } from '@/lib/session-id'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventOption {
  id: string
  title: string
  category: string
  showDate: string
  location: string
  seatSummary?: { total: number; available: number; sold: number }
  seatMapId: string | null
}

interface SeatData {
  id: string
  seatCode: string
  status: string
  row: string
  col: number
  lockedUntil: string | null
  priceCategory: { id: string; name: string; price: number; colorCode: string } | null
}

interface PriceCategoryData {
  id: string
  name: string
  price: number
  colorCode: string
}

interface ComplimentaryTicket {
  id: string
  transactionId: string
  customerName: string
  customerEmail: string
  customerWa: string
  seatCodes: string
  eventTitle: string
  createdAt: string
  paymentStatus: string
  emailSent?: boolean
}

interface SeatMapInfo {
  id: string
  name: string
  seatType: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComplimentaryTicketsPage() {
  // Events
  const [events, setEvents] = useState<EventOption[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)

  // Show dates for multi-day events
  const [showDates, setShowDates] = useState<any[]>([])
  const [selectedShowDateId, setSelectedShowDateId] = useState<string>('')

  // Seats
  const [seats, setSeats] = useState<SeatData[]>([])
  const [priceCategories, setPriceCategories] = useState<PriceCategoryData[]>([])
  const [isLoadingSeats, setIsLoadingSeats] = useState(false)
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [seatMapInfo, setSeatMapInfo] = useState<SeatMapInfo | null>(null)
  const [layoutData, setLayoutData] = useState<any>(null)

  // Session ID for locking
  const sessionIdRef = useRef('')
  useEffect(() => { sessionIdRef.current = 'ADMIN-' + getSessionId() }, [])

  // Form
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [gaQuantity, setGaQuantity] = useState(1)
  const [gaZone, setGaZone] = useState('')

  // Submit
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null)

  // Stats
  const [totalComplimentary, setTotalComplimentary] = useState(0)

  // Recent tickets
  const [recentTickets, setRecentTickets] = useState<ComplimentaryTicket[]>([])
  const [isLoadingRecent, setIsLoadingRecent] = useState(true)

  // Resend email state
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendResult, setResendResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  // ─── Derived values ─────────────────────────────────────────────────────

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId]
  )

  const isNumberedSeatMap = seatMapInfo?.seatType === 'NUMBERED'
  const isGeneralAdmission = !isNumberedSeatMap || !seatMapInfo

  // Group seats by row for the mini map
  const seatsByRow = useMemo(() => {
    const groups: Record<string, SeatData[]> = {}
    for (const seat of seats) {
      if (!groups[seat.row]) groups[seat.row] = []
      groups[seat.row].push(seat)
    }
    // Sort each row by column
    for (const row of Object.keys(groups)) {
      groups[row].sort((a, b) => a.col - b.col)
    }
    return groups
  }, [seats])

  const sortedRowKeys = useMemo(
    () => Object.keys(seatsByRow).sort(),
    [seatsByRow]
  )

  const availableSeatsCount = useMemo(
    () => seats.filter((s) => s.status === 'AVAILABLE').length,
    [seats]
  )

  // Zones for GA
  const zones = useMemo(() => {
    const zoneSet = new Set<string>()
    seats.forEach((s) => {
      if (s.status === 'AVAILABLE' && (s as any).zoneName) {
        zoneSet.add((s as any).zoneName)
      }
    })
    return Array.from(zoneSet).sort()
  }, [seats])

  // ─── Fetch events ───────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('/api/admin/events')
        if (res.ok) {
          const data = await res.json()
          setEvents(data.events || [])
        }
      } catch (err) {
        console.error('Failed to fetch events:', err)
      } finally {
        setIsLoadingEvents(false)
      }
    }
    fetchEvents()
  }, [])

  // ─── Fetch recent complimentary tickets ─────────────────────────────────

  useEffect(() => {
    async function fetchRecentTickets() {
      try {
        const res = await fetch('/api/admin/tickets/complimentary')
        if (res.ok) {
          const data = await res.json()
          setRecentTickets(data.tickets || [])
          setTotalComplimentary(data.total || 0)
        }
      } catch (err) {
        console.error('Failed to fetch recent complimentary tickets:', err)
      } finally {
        setIsLoadingRecent(false)
      }
    }
    fetchRecentTickets()
  }, [])

  // ─── Fetch seats when event is selected ─────────────────────────────────

  const fetchSeatsForEvent = useCallback(async (eventId: string, showDateFilter?: string) => {
    setIsLoadingSeats(true)
    setSelectedSeats([])
    setSeatMapInfo(null)
    setGaQuantity(1)
    setGaZone('')

    try {
      // Fetch seats with optional showDateId filter
      const seatsUrl = `/api/events/${eventId}/seats${showDateFilter ? `?showDateId=${showDateFilter}` : ''}`
      const seatsRes = await fetch(seatsUrl)
      if (seatsRes.ok) {
        const data = await seatsRes.json()
        setSeats(data.seats || [])
        setPriceCategories(data.priceCategories || [])
      }

      // Fetch event detail to get seatMapId and showDates
      const eventRes = await fetch(`/api/events/${eventId}`)
      if (eventRes.ok) {
        const eventData = await eventRes.json()
         if (eventData.seatMapId) {
          // Fetch seat map info + layoutData
          const mapRes = await fetch('/api/admin/seat-maps')
          if (mapRes.ok) {
            const mapsData = await mapRes.json()
            const map = (mapsData.seatMaps || []).find((m: any) => m.id === eventData.seatMapId)
            if (map) {
              setSeatMapInfo({ id: map.id, name: map.name, seatType: map.seatType })
              setLayoutData(map.layoutData || null)
            }
          }
        } else {
          setLayoutData(null)
        }
        // Populate show dates for multi-day events
        if (eventData.showDates && eventData.showDates.length > 0) {
          setShowDates(eventData.showDates)
          if (!showDateFilter) {
            setSelectedShowDateId(eventData.showDates[0].id)
          }
        } else {
          setShowDates([])
          setSelectedShowDateId('')
        }
      }
    } catch (err) {
      console.error('Failed to fetch seats:', err)
    } finally {
      setIsLoadingSeats(false)
    }
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      fetchSeatsForEvent(selectedEventId)
    } else {
      setSeats([])
      setSelectedSeats([])
      setSeatMapInfo(null)
      setShowDates([])
      setSelectedShowDateId('')
    }
  }, [selectedEventId, fetchSeatsForEvent])

  // Re-fetch seats when show date changes
  useEffect(() => {
    if (selectedEventId && selectedShowDateId) {
      fetchSeatsForEvent(selectedEventId, selectedShowDateId)
    }
  }, [selectedShowDateId])

  // ─── Seat selection with locking ────────────────────────────────────────

  const lockSeat = useCallback(async (codes: string[]) => {
    if (!selectedEventId || codes.length === 0) return
    try {
      await fetch('/api/seats/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEventId, seatCodes: codes, sessionId: sessionIdRef.current, showDateId: selectedShowDateId || undefined }),
      })
    } catch { /* silent */ }
  }, [selectedEventId, selectedShowDateId])

  const unlockSeat = useCallback(async (codes: string[]) => {
    if (!selectedEventId || codes.length === 0) return
    try {
      await fetch('/api/seats/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEventId, seatCodes: codes, sessionId: sessionIdRef.current, showDateId: selectedShowDateId || undefined }),
      })
    } catch { /* silent */ }
  }, [selectedEventId, selectedShowDateId])

  function toggleSeat(seatCode: string) {
    setSelectedSeats((prev) => {
      if (prev.includes(seatCode)) {
        unlockSeat([seatCode])
        return prev.filter((s) => s !== seatCode)
      } else {
        lockSeat([seatCode])
        return [...prev, seatCode]
      }
    })
  }

  function removeSeat(seatCode: string) {
    unlockSeat([seatCode])
    setSelectedSeats((prev) => prev.filter((s) => s !== seatCode))
  }

  // Unlock all on unmount / event change
  const selectedSeatsRef = useRef(selectedSeats)
  selectedSeatsRef.current = selectedSeats
  const selectedEventRef = useRef(selectedEventId)
  selectedEventRef.current = selectedEventId

  useEffect(() => {
    return () => {
      if (selectedSeatsRef.current.length > 0 && selectedEventRef.current) {
        fetch('/api/seats/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: selectedEventRef.current, seatCodes: selectedSeatsRef.current, sessionId: sessionIdRef.current }),
        }).catch(() => {})
      }
    }
  }, [])

  // Poll seats every 4s for real-time status
  useEffect(() => {
    if (!selectedEventId) return
    let cancelled = false
    const pollSeats = async () => {
      try {
        const url = `/api/events/${selectedEventId}/seats${selectedShowDateId ? `?showDateId=${selectedShowDateId}` : ''}`
        const res = await fetch(url)
        if (!res.ok || cancelled) return
        const json = await res.json()
        const data = json.seats || json
        if (!Array.isArray(data)) return
        setSeats(data)
      } catch { /* silent */ }
    }
    const interval = setInterval(pollSeats, 4000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [selectedEventId, selectedShowDateId])

  // ─── Get seat color ─────────────────────────────────────────────────────

  function getSeatColorClass(seat: SeatData): string {
    if (selectedSeats.includes(seat.seatCode)) return 'bg-gold text-white cursor-pointer hover:bg-gold-dark shadow-sm ring-2 ring-gold/50'
    if (seat.status === 'SOLD') return 'bg-red-200 text-red-600 cursor-not-allowed'
    if (seat.status === 'INVITATION') return 'bg-purple-200 text-purple-600 cursor-not-allowed'
    if (seat.status === 'LOCKED_TEMPORARY') return 'bg-amber-200 text-amber-700 cursor-not-allowed'
    if (seat.status !== 'AVAILABLE') return 'bg-gray-300 text-gray-500 cursor-not-allowed'
    return 'bg-emerald-100 text-emerald-800 cursor-pointer hover:bg-emerald-200 hover:shadow-sm'
  }

  // Parse layoutData for canvas-accurate rendering
  const parsedLayout = useMemo(() => parseLayoutData(layoutData), [layoutData]) as ParsedLayout | null

  // ─── Resend email ───────────────────────────────────────────────────────

  async function handleResendEmail(ticketId: string, transactionId: string) {
    setResendingId(ticketId)
    setResendResult(null)

    try {
      const res = await fetch('/api/usher/resend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      })

      const data = await res.json()

      if (res.ok) {
        setResendResult({ id: ticketId, success: true, message: 'E-tiket berhasil dikirim ulang!' })
      } else {
        setResendResult({ id: ticketId, success: false, message: data.error || 'Gagal mengirim ulang.' })
      }
    } catch {
      setResendResult({ id: ticketId, success: false, message: 'Terjadi kesalahan jaringan.' })
    } finally {
      setResendingId(null)
      // Auto-hide after 5 seconds
      setTimeout(() => setResendResult(null), 5000)
    }
  }

  // ─── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!selectedEventId || !guestName || !guestEmail || !guestPhone) {
      setSubmitResult({ success: false, message: 'Harap lengkapi semua field yang wajib diisi.' })
      return
    }

    let seatCodes: string[]

    if (isNumberedSeatMap) {
      if (selectedSeats.length === 0) {
        setSubmitResult({ success: false, message: 'Harap pilih minimal 1 kursi.' })
        return
      }
      seatCodes = selectedSeats
    } else {
      if (gaQuantity < 1) {
        setSubmitResult({ success: false, message: 'Jumlah tiket minimal 1.' })
        return
      }
      // Generate GA seat codes
      seatCodes = Array.from({ length: gaQuantity }, (_, i) =>
        gaZone ? `${gaZone}-${i + 1}` : `GA-${i + 1}`
      )
    }

    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      const res = await fetch('/api/admin/tickets/complimentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          seatCodes,
          guestName,
          guestEmail,
          guestPhone,
          showDateId: selectedShowDateId || undefined,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setSubmitResult({
          success: true,
          message: `Tiket komplimen berhasil dibuat! Transaction ID: ${data.transactionId}`,
        })
        // Reset form
        setGuestName('')
        setGuestEmail('')
        setGuestPhone('')
        setSelectedSeats([])
        setGaQuantity(1)
        setGaZone('')
        // Refresh recent tickets
        const recentRes = await fetch('/api/admin/tickets/complimentary')
        if (recentRes.ok) {
          const recentData = await recentRes.json()
          setRecentTickets(recentData.tickets || [])
          setTotalComplimentary(recentData.total || 0)
        }
      } else {
        setSubmitResult({
          success: false,
          message: data.error || 'Gagal membuat tiket komplimen.',
        })
      }
    } catch (err) {
      setSubmitResult({
        success: false,
        message: 'Terjadi kesalahan jaringan. Silakan coba lagi.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Parse seat codes from JSON string ──────────────────────────────────

  function parseSeatCodes(codes: string): string[] {
    if (!codes) return []
    try {
      return JSON.parse(codes)
    } catch {
      return codes.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
            <Gift className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold text-charcoal">Tiket Komplimen</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Buat tiket gratis untuk tamu undangan</p>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
              <Ticket className="w-6 h-6 text-gold" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Tiket Komplimen</p>
              <p className="text-2xl font-bold text-charcoal mt-0.5">
                {isLoadingRecent ? (
                  <Loader2 className="w-6 h-6 text-gold animate-spin inline" />
                ) : (
                  totalComplimentary
                )}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-charcoal/5 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-charcoal/60" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Tamu Undangan</p>
              <p className="text-2xl font-bold text-charcoal mt-0.5">
                {isLoadingRecent ? (
                  <Loader2 className="w-6 h-6 text-gold animate-spin inline" />
                ) : (
                  recentTickets.length > 0
                    ? new Set(recentTickets.map((t) => t.customerEmail)).size
                    : 0
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Card */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-lg text-charcoal flex items-center gap-2">
            <Send className="w-4 h-4 text-gold" />
            Buat Tiket Komplimen Baru
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Submit Result Message */}
          {submitResult && (
            <div
              className={`flex items-start gap-3 p-4 rounded-lg text-sm ${
                submitResult.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {submitResult.success ? (
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <p>{submitResult.message}</p>
              <button
                onClick={() => setSubmitResult(null)}
                className="ml-auto flex-shrink-0 hover:opacity-70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 1: Event Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              Pilih Event <span className="text-danger">*</span>
            </Label>
            {isLoadingEvents ? (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-gold" />
                Memuat daftar event...
              </div>
            ) : (
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Pilih event..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{event.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatShortDate(event.showDate)} · {event.location}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Selected event info */}
            {selectedEvent && (
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-xs">
                  {selectedEvent.category}
                </Badge>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatEventDateTime(selectedEvent.showDate)}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {selectedEvent.location}
                </span>
                {selectedEvent.seatSummary && (
                  <span className="flex items-center gap-1">
                    <Ticket className="w-3 h-3" />
                    {selectedEvent.seatSummary.available} kursi tersedia
                  </span>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Step 2: Guest Information */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Informasi Tamu</Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Nama Tamu <span className="text-danger">*</span>
                </Label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Contoh: Bapak Joko Widodo"
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email Tamu <span className="text-danger">*</span>
                </Label>
                <Input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="tamu@email.com"
                  className="bg-white"
                />
              </div>
            </div>

            <div className="space-y-2 sm:max-w-md">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" />
                No. WhatsApp <span className="text-danger">*</span>
              </Label>
              <Input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="bg-white"
              />
            </div>
          </div>

          <Separator />

          {/* Step 3: Seat Selection */}
          <div className="space-y-4">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Ticket className="w-4 h-4 text-gold" />
              Pemilihan Kursi
            </Label>

            {/* Show Date Tabs for multi-day events */}
            {showDates.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                {showDates.map((sd: any, idx: number) => {
                  const sdLabel = sd.label || `Hari ${idx + 1}`
                  const sdDate = new Date(sd.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                  return (
                    <button
                      key={sd.id}
                      onClick={() => setSelectedShowDateId(sd.id)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-all border',
                        selectedShowDateId === sd.id
                          ? 'bg-gold text-white border-gold'
                          : 'bg-white text-muted-foreground border-border hover:border-gold/50'
                      )}
                    >
                      {sdLabel} ({sdDate})
                    </button>
                  )
                })}
              </div>
            )}

            {!selectedEventId ? (
              <div className="text-sm text-muted-foreground py-6 text-center bg-muted/30 rounded-lg">
                Pilih event terlebih dahulu untuk melihat pilihan kursi.
              </div>
            ) : isLoadingSeats ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin text-gold" />
                Memuat data kursi...
              </div>
            ) : isNumberedSeatMap ? (
              /* ─── Numbered Seat Map ────────────────────────────── */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Kursi tersedia: <span className="font-semibold text-charcoal">{availableSeatsCount}</span>
                  </p>
                  {selectedSeats.length > 0 && (
                    <Badge className="bg-gold text-white text-xs">
                      {selectedSeats.length} dipilih
                    </Badge>
                  )}
                </div>

                {/* Canvas-Accurate Seat Map */}
                <div className="bg-muted/20 rounded-xl p-4 overflow-x-auto">
                  {parsedLayout ? (() => {
                    const SEAT_W = 28, SEAT_GAP = 3, LABEL_W = 24
                    const CELL = SEAT_W + SEAT_GAP
                    const { displayRows, gridSize: { cols }, rowSeatMap, embeddedInto, aisleColumns, rowLabels: lLabels, sections } = parsedLayout
                    const stageType = parsedLayout.stageType || 'PROSCENIUM'
                    const stageSize = (parsedLayout.stageSize || 'md') as 'sm' | 'md' | 'lg'
                    const isInsetStage = stageType === 'BLACK_BOX' || stageType === 'ARENA'
                    const gridW = cols * CELL - SEAT_GAP + LABEL_W * 2 + 12

                    // Build lookup
                    const seatLookup = new Map<string, SeatData>()
                    for (const s of seats) seatLookup.set(s.seatCode, s)

                    const gridLookup = new Map<number, Map<number, { seatCode: string; seatNum: number }>>()
                    for (const ri of displayRows) {
                      const colMap = new Map<number, { seatCode: string; seatNum: number }>()
                      const directSeats = rowSeatMap.get(ri) || []
                      const label = lLabels[ri] || String.fromCharCode(65 + ri)
                      for (const s of directSeats) colMap.set(s.c, { seatCode: `${label}-${s.seatNum}`, seatNum: s.seatNum })
                      const srcRows = embeddedInto[ri] || []
                      for (const srcRi of srcRows) {
                        const srcSeats = rowSeatMap.get(srcRi) || []
                        const srcLabel = lLabels[srcRi] || String.fromCharCode(65 + srcRi)
                        for (const s of srcSeats) colMap.set(s.c, { seatCode: `${srcLabel}-${s.seatNum}`, seatNum: s.seatNum })
                      }
                      gridLookup.set(ri, colMap)
                    }

                    const getRowColor = (ri: number) => {
                      if (!sections) return '#8B8680'
                      for (const sec of sections) { if (ri >= sec.startRow && ri <= sec.endRow) return sec.colorCode || '#8B8680' }
                      return '#8B8680'
                    }

                    return (
                      <div className="relative mx-auto w-fit flex flex-col items-center" style={{ minWidth: gridW }}>
                        {/* Inline stage */}
                        {!isInsetStage && (
                          <StageRenderer stageType={stageType} size={stageSize} thrustWidth={parsedLayout.thrustWidth} thrustDepth={parsedLayout.thrustDepth} />
                        )}
                        {displayRows.map((ri, idx) => {
                          const label = lLabels[ri] || String.fromCharCode(65 + ri)
                          const colMap = gridLookup.get(ri) || new Map()
                          const rowColor = getRowColor(ri)
                          const middleRow = isInsetStage ? Math.floor(displayRows.length / 2) : -1
                          return (
                            <React.Fragment key={ri}>
                              {isInsetStage && idx === middleRow && (
                                <div className="flex justify-center my-3">
                                  <StageRenderer stageType={stageType} size={stageSize} thrustWidth={parsedLayout.thrustWidth} thrustDepth={parsedLayout.thrustDepth} />
                                </div>
                              )}
                              <div className="flex items-center mb-[3px]" style={{ height: SEAT_W }}>
                                <div className="w-6 text-center text-xs font-semibold font-serif shrink-0" style={{ color: rowColor }}>{label}</div>
                                <div className="flex items-center" style={{ gap: SEAT_GAP, height: SEAT_W }}>
                                  {Array.from({ length: cols }, (_, c) => {
                                    if (aisleColumns.includes(c)) {
                                      return <div key={c} className="shrink-0 bg-border/30 rounded-full mx-0.5" style={{ width: 2, height: SEAT_W * 0.6 }} />
                                    }
                                    const info = colMap.get(c)
                                    if (info) {
                                      const sd = seatLookup.get(info.seatCode)
                                      const isAvailable = sd?.status === 'AVAILABLE'
                                      const isSelected = selectedSeats.includes(info.seatCode)
                                      return (
                                        <button
                                          key={c}
                                          onClick={() => (isAvailable || isSelected) ? toggleSeat(info.seatCode) : undefined}
                                          disabled={!isAvailable && !isSelected}
                                          className={cn(
                                            'rounded text-[10px] font-mono font-medium flex items-center justify-center transition-all shrink-0',
                                            sd ? getSeatColorClass(sd) : 'bg-gray-200 cursor-not-allowed'
                                          )}
                                          style={{ width: SEAT_W, height: SEAT_W }}
                                          title={`${info.seatCode} - ${sd?.status || 'N/A'}`}
                                        >
                                          {info.seatNum}
                                        </button>
                                      )
                                    }
                                    return <div key={c} style={{ width: SEAT_W, height: SEAT_W }} className="shrink-0" />
                                  })}
                                </div>
                                <div className="w-6 text-center text-xs font-semibold font-serif shrink-0" style={{ color: rowColor }}>{label}</div>
                              </div>
                            </React.Fragment>
                          )
                        })}
                      </div>
                    )
                  })() : (
                    /* Fallback: simple row grid if no layoutData */
                    <div className="mx-auto w-full flex flex-col items-center">
                      <div className="text-center mb-3">
                        <div className="bg-charcoal text-white text-[10px] uppercase tracking-widest px-6 py-1.5 rounded-full inline-block">Panggung</div>
                      </div>
                      {sortedRowKeys.map((row) => (
                        <div key={row} className="flex items-center gap-2 mb-1.5">
                          <span className="w-6 text-xs font-mono font-semibold text-charcoal/60 text-right">{row}</span>
                          <div className="flex gap-1 flex-1">
                            {seatsByRow[row].map((seat) => (
                              <button
                                key={seat.id}
                                onClick={() => (seat.status === 'AVAILABLE' || selectedSeats.includes(seat.seatCode)) ? toggleSeat(seat.seatCode) : undefined}
                                disabled={seat.status !== 'AVAILABLE' && !selectedSeats.includes(seat.seatCode)}
                                className={cn('w-8 h-8 rounded text-[10px] font-mono font-medium flex items-center justify-center transition-all', getSeatColorClass(seat))}
                                title={`${seat.seatCode} - ${seat.status}`}
                              >
                                {seat.col}
                              </button>
                            ))}
                          </div>
                          <span className="w-6 text-xs font-mono font-semibold text-charcoal/60">{row}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-3 mt-4 flex-wrap text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200" />
                      Tersedia
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-gold border border-gold-dark" />
                      Dipilih
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-red-200 border border-red-300" />
                      Terjual
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-amber-200 border border-amber-300" />
                      Dikunci
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-purple-200 border border-purple-300" />
                      Undangan
                    </div>
                  </div>
                </div>

                {/* Selected Seat Badges */}
                {selectedSeats.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Kursi yang dipilih:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSeats.map((code) => (
                        <Badge
                          key={code}
                          className="bg-gold text-white text-xs cursor-pointer hover:bg-gold-dark transition-colors"
                          onClick={() => removeSeat(code)}
                        >
                          {code}
                          <X className="w-3 h-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ─── General Admission ─────────────────────────────── */
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Event ini menggunakan sistem General Admission. Masukkan jumlah tiket yang diinginkan.
                </p>

                {zones.length > 0 && (
                  <div className="space-y-2 sm:max-w-md">
                    <Label className="text-xs text-muted-foreground">Zone / Nama Area</Label>
                    <Select value={gaZone} onValueChange={setGaZone}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Pilih zone..." />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((z) => (
                          <SelectItem key={z} value={z}>
                            {z}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {zones.length === 0 && (
                  <div className="space-y-2 sm:max-w-md">
                    <Label className="text-xs text-muted-foreground">Zone / Nama Area (opsional)</Label>
                    <Input
                      value={gaZone}
                      onChange={(e) => setGaZone(e.target.value)}
                      placeholder="Contoh: VIP, Festival Kiri"
                      className="bg-white"
                    />
                  </div>
                )}

                <div className="space-y-2 sm:max-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Jumlah Tiket <span className="text-danger">*</span></Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setGaQuantity((q) => Math.max(1, q - 1))}
                      disabled={gaQuantity <= 1}
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={gaQuantity}
                      onChange={(e) => setGaQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-9 text-center bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setGaQuantity((q) => Math.min(100, q + 1))}
                      disabled={gaQuantity >= 100}
                    >
                      +
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Kode kursi akan di-generate otomatis (e.g. {gaZone ? `${gaZone}-` : 'GA-'}1, {gaZone ? `${gaZone}-` : 'GA-'}2, ...)
                  </p>
                </div>

                {/* Preview */}
                <div className="bg-muted/20 rounded-lg p-3 text-xs">
                  <p className="font-medium text-charcoal mb-1">Preview:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: gaQuantity }, (_, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {gaZone ? `${gaZone}-${i + 1}` : `GA-${i + 1}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Step 4: Summary */}
          {(selectedEventId && (selectedSeats.length > 0 || (!isNumberedSeatMap && gaQuantity >= 1))) && (
            <div className="bg-charcoal/5 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-charcoal">Ringkasan</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Event:</span>{' '}
                  <span className="font-medium">{selectedEvent?.title}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tamu:</span>{' '}
                  <span className="font-medium">{guestName || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>{' '}
                  <span className="font-medium">{guestEmail || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">WhatsApp:</span>{' '}
                  <span className="font-medium">{guestPhone || '-'}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Kursi:</span>{' '}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {isNumberedSeatMap
                      ? selectedSeats.map((code) => (
                          <Badge key={code} className="bg-gold text-white text-[10px]">{code}</Badge>
                        ))
                      : Array.from({ length: gaQuantity }, (_, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {gaZone ? `${gaZone}-${i + 1}` : `GA-${i + 1}`}
                          </Badge>
                        ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !selectedEventId ||
                !guestName ||
                !guestEmail ||
                !guestPhone ||
                (isNumberedSeatMap ? selectedSeats.length === 0 : gaQuantity < 1)
              }
              className="bg-charcoal hover:bg-charcoal/90 text-gold min-w-[200px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Kirim Tiket Komplimen
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Complimentary Tickets */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-lg text-charcoal flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold" />
            Tiket Komplimen Terbaru
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingRecent ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gold animate-spin" />
            </div>
          ) : recentTickets.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada tiket komplimen yang dibuat</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Transaction ID</TableHead>
                    <TableHead className="text-xs">Nama Tamu</TableHead>
                    <TableHead className="text-xs">Event</TableHead>
                    <TableHead className="text-xs">Kursi</TableHead>
                    <TableHead className="text-xs">Dibuat</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                    <TableHead className="text-xs text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTickets.map((ticket) => {
                    const seatCodes = parseSeatCodes(ticket.seatCodes)
                    return (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-gold">
                            {ticket.transactionId}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{ticket.customerName}</p>
                            <p className="text-[10px] text-muted-foreground">{ticket.customerEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-medium">{ticket.eventTitle}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {seatCodes.length <= 3
                              ? seatCodes.map((code) => (
                                  <Badge key={code} variant="secondary" className="text-[10px]">
                                    {code}
                                  </Badge>
                                ))
                              : (
                                  <>
                                    {seatCodes.slice(0, 3).map((code) => (
                                      <Badge key={code} variant="secondary" className="text-[10px]">
                                        {code}
                                      </Badge>
                                    ))}
                                    <Badge variant="outline" className="text-[10px]">
                                      +{seatCodes.length - 3}
                                    </Badge>
                                  </>
                                )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatShortDate(ticket.createdAt)}
                        </TableCell>
                        <TableCell className="text-center">
                          {ticket.emailSent ? (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              TERKIRIM
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 text-[10px] border-red-200">
                              <XCircle className="w-3 h-3 mr-1" />
                              GAGAL
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] gap-1"
                            onClick={() => handleResendEmail(ticket.id, ticket.transactionId)}
                            disabled={resendingId === ticket.id}
                          >
                            {resendingId === ticket.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                            Kirim Ulang
                          </Button>
                          {resendResult?.id === ticket.id && (
                            <p className={`text-[10px] mt-1 ${resendResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                              {resendResult.message}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
