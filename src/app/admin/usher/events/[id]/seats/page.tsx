'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { parseLayoutData, type ParsedLayout } from '@/lib/seat-layout'
import { StageRenderer } from '@/lib/stage-renderer'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet'
import {
  Check, X, Crown, User, GraduationCap, Loader2,
  ArrowLeft, Mail, Phone, Hash, Clock, CreditCard, Users, Send,
  Maximize2, Minimize2
} from 'lucide-react'

// =====================
// Types
// =====================
interface SeatData {
  id: string
  seatCode: string
  status: string
  row: string
  col: number
  priceCategory: {
    id: string
    name: string
    price: number
    colorCode: string
  } | null
  lockedUntil: string | null
}

interface PriceCategoryData {
  id: string
  name: string
  price: number
  colorCode: string
}

interface SeatOwnerInfo {
  owner: string
  email: string
  phone: string
  transactionId: string
  paymentStatus: string
  checkInTime: string | null
  paidAt: string | null
  totalAmount: number
}

interface EventData {
  id: string
  title: string
  category: string
  showDate: string
  location: string
  seatMapLayout?: any
  showDates?: Array<{ id: string; date: string; openGate: string | null; label: string | null }>
}

// Category display config
const CATEGORY_CONFIG: Record<string, { icon: typeof Crown; label: string; defaultColor: string }> = {
  VIP: { icon: Crown, label: 'VIP', defaultColor: '#C8A951' },
  Regular: { icon: User, label: 'Regular', defaultColor: '#8B8680' },
  Student: { icon: GraduationCap, label: 'Student', defaultColor: '#7BA7A5' },
}

const SEAT_W = 28
const SEAT_GAP = 3

// =====================
// Component
// =====================
export default function UsherSeatMapPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string

  const [seats, setSeats] = useState<SeatData[]>([])
  const [priceCategories, setPriceCategories] = useState<PriceCategoryData[]>([])
  const [selectedShowDateIdx, setSelectedShowDateIdx] = useState(0)
  const [event, setEvent] = useState<EventData | null>(null)
  const [seatOwnerMap, setSeatOwnerMap] = useState<Record<string, SeatOwnerInfo>>({})
  const [selectedSeat, setSelectedSeat] = useState<SeatOwnerInfo | null>(null)
  const [selectedSeatCode, setSelectedSeatCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [resendResult, setResendResult] = useState<{ success: boolean; message: string } | null>(null)
  const [stageSize, setStageSize] = useState<'sm' | 'md' | 'lg'>('md')
  const [infoSheetOpen, setInfoSheetOpen] = useState(false)

  // Parse layout data from event's seat map
  const parsedLayout = useMemo(() => parseLayoutData(event?.seatMapLayout), [event?.seatMapLayout]) as ParsedLayout | null

  // Show dates with fallback for single-day events
  const showDates = useMemo(() =>
    event?.showDates && event.showDates.length > 0
      ? event.showDates
      : [{ id: null, date: event?.showDate, openGate: null, label: null }],
    [event]
  )
  const activeShowDate = showDates[selectedShowDateIdx] || showDates[0]

  // Stage type from layout data
  const stageType = parsedLayout?.stageType || 'PROSCENIUM'
  const isInsetStage = stageType === 'BLACK_BOX' || stageType === 'ARENA'

  // Seat lookup by seatCode
  const seatLookup = useMemo(() => {
    const map = new Map<string, SeatData>()
    for (const seat of seats) {
      map.set(seat.seatCode, seat)
    }
    return map
  }, [seats])

  // Fetch event data (once)
  useEffect(() => {
    if (!eventId) return

    async function fetchEvent() {
      try {
        const eventRes = await fetch(`/api/events/${eventId}`)
        if (!eventRes.ok) throw new Error('Failed to fetch event data')
        const eventData = await eventRes.json()
        setEvent({
          id: eventData.id,
          title: eventData.title,
          category: eventData.category,
          showDate: eventData.showDate,
          location: eventData.location,
          seatMapLayout: eventData.seatMapLayout || null,
          showDates: eventData.showDates || null,
        })
      } catch (err) {
        setError('Gagal memuat data event')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvent()
  }, [eventId])

  // Fetch seats filtered by active show date, and seats-info
  useEffect(() => {
    if (!eventId || !event) return
    let cancelled = false

    async function fetchSeats() {
      try {
        const seatsUrl = activeShowDate?.id
          ? `/api/events/${eventId}/seats?showDateId=${activeShowDate.id}`
          : `/api/events/${eventId}/seats`
        const [seatsRes, infoRes] = await Promise.all([
          fetch(seatsUrl),
          fetch(`/api/usher/seats-info?eventId=${eventId}`),
        ])

        if (cancelled) return
        if (seatsRes.ok) {
          const seatsData = await seatsRes.json()
          setSeats(seatsData.seats || [])
          setPriceCategories(seatsData.priceCategories || [])
        }
        if (infoRes.ok) {
          const infoData = await infoRes.json()
          if (!cancelled) setSeatOwnerMap(infoData.seats || {})
        }
      } catch {
        // silent
      }
    }

    fetchSeats()

    // Auto-refresh every 5 seconds
    const interval = setInterval(async () => {
      try {
        const seatsUrl = activeShowDate?.id
          ? `/api/events/${eventId}/seats?showDateId=${activeShowDate.id}`
          : `/api/events/${eventId}/seats`
        const [seatsRes, infoRes] = await Promise.all([
          fetch(seatsUrl),
          fetch(`/api/usher/seats-info?eventId=${eventId}`),
        ])

        if (cancelled) return
        if (seatsRes.ok) {
          const seatsData = await seatsRes.json()
          if (!cancelled) setSeats(seatsData.seats || [])
        }

        if (infoRes.ok) {
          const infoData = await infoRes.json()
          if (!cancelled) {
            setSeatOwnerMap(infoData.seats || {})
            if (selectedSeatCode && infoData.seats?.[selectedSeatCode]) {
              setSelectedSeat(infoData.seats[selectedSeatCode])
            }
          }
        }
      } catch {
        // silent
      }
    }, 5000)

    return () => { cancelled = true; clearInterval(interval) }
  }, [eventId, event, activeShowDate?.id, selectedSeatCode])

  // Handle seat click (read-only — sold and invitation seats show info)
  const handleSeatClick = useCallback((seat: SeatData) => {
    if (seat.status === 'SOLD' || seat.status === 'INVITATION') {
      const ownerInfo = seatOwnerMap[seat.seatCode]
      if (ownerInfo) {
        setSelectedSeatCode(seat.seatCode)
        setSelectedSeat(ownerInfo)
        setResendResult(null)
        setInfoSheetOpen(true)
      }
    } else {
      setSelectedSeatCode(null)
      setSelectedSeat(null)
      setResendResult(null)
      setInfoSheetOpen(false)
    }
  }, [seatOwnerMap])

  // Resend email
  async function handleResendEmail() {
    if (!selectedSeat?.transactionId) return
    setIsResending(true)
    setResendResult(null)

    try {
      const res = await fetch('/api/usher/resend-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: selectedSeat.transactionId }),
      })

      const data = await res.json()
      if (res.ok) {
        setResendResult({ success: true, message: 'E-tiket berhasil dikirim ulang!' })
      } else {
        setResendResult({ success: false, message: data.error || 'Gagal mengirim ulang e-tiket.' })
      }
    } catch {
      setResendResult({ success: false, message: 'Terjadi kesalahan jaringan.' })
    } finally {
      setIsResending(false)
    }
  }

  // Compute seat stats
  const totalSeats = seats.length
  const soldSeats = seats.filter((s) => s.status === 'SOLD').length
  const invitationSeats = seats.filter((s) => s.status === 'INVITATION').length
  const availableSeats = seats.filter((s) => s.status === 'AVAILABLE').length
  const lockedSeats = seats.filter((s) => s.status === 'LOCKED_TEMPORARY').length
  const checkedInSeats = Object.values(seatOwnerMap).filter((s) => s.checkInTime).length

  const getSeatColor = (seat: SeatData) => {
    if (seat.status === 'SOLD') {
      const ownerInfo = seatOwnerMap[seat.seatCode]
      if (ownerInfo?.checkInTime) return 'bg-success'
      return 'bg-seat-sold'
    }
    if (seat.status === 'LOCKED_TEMPORARY') return 'bg-seat-locked'
    if (seat.status === 'INVITATION') return 'bg-seat-invitation'
    if (seat.status === 'UNAVAILABLE') return 'bg-gray-200 opacity-30'
    return 'bg-white border-2'
  }

  const getSeatBorderColor = (seat: SeatData) => {
    if (seat.status === 'AVAILABLE') return seat.priceCategory?.colorCode || '#C8A951'
    return 'transparent'
  }

  const getRowColorFromSections = (rowIdx: number) => {
    if (!parsedLayout) return '#8B8680'
    const section = parsedLayout.sections.find((s: any) => rowIdx >= s.fromRow && rowIdx <= s.toRow)
    if (section) return CATEGORY_CONFIG[section.name]?.defaultColor || section.colorCode
    return '#8B8680'
  }

  // ── Render seat button (shared by both modes) ──
  const renderSeatButton = (seatData: SeatData | undefined, seatCode: string, displayNum: number, key: string) => {
    if (!seatData) {
      return <div key={key} style={{ width: SEAT_W, height: SEAT_W }} className="shrink-0" />
    }

    const isSold = seatData.status === 'SOLD'
    const isLocked = seatData.status === 'LOCKED_TEMPORARY'
    const isUnavailable = seatData.status === 'UNAVAILABLE'
    const isInvitation = seatData.status === 'INVITATION'
    const isClickable = isSold || isInvitation
    const isSelected = selectedSeatCode === seatCode

    return (
      <button
        key={key}
        onClick={() => isClickable && handleSeatClick(seatData)}
        className={cn(
          'shrink-0 rounded-md flex items-center justify-center text-[9px] sm:text-[10px] font-medium transition-all duration-200',
          getSeatColor(seatData),
          isClickable && 'cursor-pointer hover:scale-110 hover:shadow-md',
          !isClickable && 'cursor-default',
          isUnavailable && 'opacity-20',
          (isSold || isInvitation) && 'text-white',
          isLocked && 'text-white',
          isSelected && 'ring-2 ring-gold ring-offset-1'
        )}
        style={{
          width: SEAT_W,
          height: SEAT_W,
          ...(seatData.status === 'AVAILABLE' ? { borderColor: getSeatBorderColor(seatData) } : {}),
        }}
        title={
          (isSold || isInvitation)
            ? `${seatCode} — Klik untuk detail`
            : isLocked
            ? `${seatCode} — Dikunci`
            : seatData.status === 'AVAILABLE'
            ? `${seatCode} — Tersedia`
            : `${seatCode}`
        }
      >
        {isSold && <Check className="w-3 h-3" />}
        {isLocked && <span className="text-[8px]">⏳</span>}
        {isUnavailable && <X className="w-3 h-3" />}
        {isInvitation && <span className="text-[8px]">🎉</span>}
        {!isSold && !isLocked && !isUnavailable && !isInvitation && (
          <span className="sm:hidden">{displayNum}</span>
        )}
        {!isSold && !isLocked && !isUnavailable && !isInvitation && (
          <span className="hidden sm:inline">{displayNum}</span>
        )}
      </button>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-gold animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Memuat peta kursi...</p>
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="text-center py-20">
        <p className="text-danger text-sm">{error || 'Event tidak ditemukan'}</p>
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mt-3">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Kembali
        </Button>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: LayoutData Mode — Flat Grid (1:1 with editor)
  // ═══════════════════════════════════════════════════════════
  let seatGridContent: React.ReactNode

  if (parsedLayout) {
    const { gridSize, rowLabels: lLabels, rowSeatMap, embeddedRows, displayRows } = parsedLayout
    const { cols } = gridSize
    const aisleColumns: number[] = parsedLayout.aisleColumns || []

    // Build reverse map: target row → source rows
    const embeddedInto: Record<number, number[]> = {}
    for (const [srcStr, tgt] of Object.entries(embeddedRows)) {
      const src = parseInt(srcStr)
      if (!embeddedInto[tgt]) embeddedInto[tgt] = []
      embeddedInto[tgt].push(src)
    }

    // Build grid lookup: displayRow → col → { seatCode, seatNum }
    const gridLookup = new Map<number, Map<number, { seatCode: string; seatNum: number }>>()
    for (const ri of displayRows) {
      const colMap = new Map<number, { seatCode: string; seatNum: number }>()

      const rowSeats = rowSeatMap.get(ri) || []
      for (const s of rowSeats) {
        const label = lLabels[ri] || String.fromCharCode(65 + ri)
        colMap.set(s.c, { seatCode: `${label}-${s.seatNum}`, seatNum: s.seatNum })
      }

      const srcRows = embeddedInto[ri] || []
      for (const srcRi of srcRows) {
        const srcSeats = rowSeatMap.get(srcRi) || []
        const srcLabel = lLabels[srcRi] || String.fromCharCode(65 + srcRi)
        for (const s of srcSeats) {
          colMap.set(s.c, { seatCode: `${srcLabel}-${s.seatNum}`, seatNum: s.seatNum })
        }
      }

      gridLookup.set(ri, colMap)
    }

    const CELL_TOTAL = SEAT_W + SEAT_GAP
    const gridW = cols * CELL_TOTAL - SEAT_GAP + 60
    const LABEL_W = 24 // w-6 = 24px
    const middleRowIndex = isInsetStage ? Math.floor(displayRows.length / 2) : -1
    const stagePosition = parsedLayout?.stagePosition
    const hasCustomStagePosition = stagePosition && typeof stagePosition.x === 'number'

    // ── Canvas → Usher View coordinate mapping ──────────────────────────
    const csb = parsedLayout?.canvasSeatBounds
    const hasBounds = !!csb && cols > 0 && displayRows.length > 0
    const guestGridW = cols * CELL_TOTAL
    const guestGridH = displayRows.length * CELL_TOTAL

    function toGuest(cx: number, cy: number, cw: number, ch: number) {
      if (!csb) return { x: cx, y: cy, w: cw, h: ch }
      return {
        x: LABEL_W + ((cx - csb.originX) / csb.spanX) * guestGridW,
        y: ((cy - csb.originY) / csb.spanY) * guestGridH,
        w: (cw / csb.spanX) * guestGridW,
        h: (ch / csb.spanY) * guestGridH,
      }
    }

    let stageGuest = hasCustomStagePosition && hasBounds
      ? toGuest(stagePosition.x, stagePosition.y, stagePosition.width, stagePosition.height) : null
    const allGuestYs: number[] = []
    if (stageGuest) allGuestYs.push(stageGuest.y)
    const minGuestY = allGuestYs.length > 0 ? Math.min(...allGuestYs) : 0
    const paddingTop = minGuestY < 0 ? Math.ceil(-minGuestY) + 4 : 0
    if (stageGuest && paddingTop > 0) {
      stageGuest = { ...stageGuest, y: stageGuest.y + paddingTop }
    }

    seatGridContent = (
      <div className="mx-auto w-fit flex flex-col items-center relative" style={{ minWidth: gridW, paddingTop }}>
        {/* Custom stage position — absolutely positioned ABOVE seats as overlay layer */}
        {hasCustomStagePosition && !isInsetStage && stageGuest && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: stageGuest.x,
              top: stageGuest.y,
              width: stageGuest.w,
              height: stageGuest.h,
              zIndex: 10,
            }}
          >
            <StageRenderer
              stageType={stageType}
              size={stageSize}
              thrustWidth={parsedLayout?.thrustWidth}
              thrustDepth={parsedLayout?.thrustDepth}
              fillParent
            />
          </div>
        )}

        {/* Top stage for PROSCENIUM, AMPHITHEATER, THRUST — inside scroll container */}
        {!isInsetStage && !hasCustomStagePosition && (
          <div className="flex justify-center mb-4">
            <StageRenderer
              stageType={stageType}
              size={stageSize}
              thrustWidth={parsedLayout?.thrustWidth}
              thrustDepth={parsedLayout?.thrustDepth}
            />
          </div>
        )}

        {displayRows.map((ri, idx) => (
          <React.Fragment key={ri}>
            {/* Inset stage (BLACK_BOX / ARENA) in the middle of rows */}
            {isInsetStage && idx === middleRowIndex && (
              <div className="flex justify-center my-3">
                <StageRenderer
                  stageType={stageType}
                  size={stageSize}
                  thrustWidth={parsedLayout?.thrustWidth}
                  thrustDepth={parsedLayout?.thrustDepth}
                />
              </div>
            )}

            <div className="flex items-center mb-[3px]" style={{ height: SEAT_W }}>
              <div className="w-6 text-center text-xs font-semibold font-serif shrink-0" style={{ color: getRowColorFromSections(ri) }}>
                {lLabels[ri] || String.fromCharCode(65 + ri)}
              </div>
              <div className="flex items-center" style={{ gap: SEAT_GAP, height: SEAT_W }}>
                {Array.from({ length: cols }, (_, c) => {
                  if (aisleColumns.includes(c)) {
                    return (
                      <div key={c} className="shrink-0 bg-border/30 rounded-full mx-0.5"
                        style={{ width: 2, height: SEAT_W * 0.6 }} />
                    )
                  }

                  const seatInfo = (gridLookup.get(ri) || new Map()).get(c)
                  if (seatInfo) {
                    const seatData = seatLookup.get(seatInfo.seatCode)
                    return renderSeatButton(seatData, seatInfo.seatCode, seatInfo.seatNum, `${ri}-${c}`)
                  }

                  return <div key={c} style={{ width: SEAT_W, height: SEAT_W }} className="shrink-0" />
                })}
              </div>
              <div className="w-6 text-center text-xs font-semibold font-serif shrink-0" style={{ color: getRowColorFromSections(ri) }}>
                {lLabels[ri] || String.fromCharCode(65 + ri)}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    )
  } else {
    // ═══════════════════════════════════════════════════════════
    // RENDER: Fallback — Dynamic from DB seats (no seat map editor)
    // ═══════════════════════════════════════════════════════════
    const groups: Record<string, SeatData[]> = {}
    for (const seat of seats) {
      if (!groups[seat.row]) groups[seat.row] = []
      groups[seat.row].push(seat)
    }
    for (const row of Object.keys(groups)) {
      groups[row].sort((a, b) => a.col - b.col)
    }
    const sortedRowKeys = Object.keys(groups).sort()

    seatGridContent = (
      <div className="mx-auto w-full flex flex-col items-center">
        {/* Top stage — inside scroll container */}
        <div className="flex justify-center mb-4">
          <StageRenderer stageType={stageType} size={stageSize} />
        </div>

        {sortedRowKeys.map((row) => {
          const rowSeats = groups[row]
          const catName = rowSeats[0]?.priceCategory?.name
          const rowColor = catName ? (CATEGORY_CONFIG[catName]?.defaultColor || '#8B8680') : '#8B8680'

          return (
            <div key={row} className="flex items-center gap-1 mb-1">
              <div className="w-6 text-center text-xs font-semibold font-serif shrink-0" style={{ color: rowColor }}>
                {row}
              </div>
              <div className="flex gap-1 justify-center flex-1 flex-wrap">
                {rowSeats.map((seat) => {
                  return renderSeatButton(seat, seat.seatCode, seat.col, seat.seatCode)
                })}
              </div>
              <div className="w-6 text-center text-xs font-semibold font-serif shrink-0" style={{ color: rowColor }}>
                {row}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // FULL RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button
            onClick={() => router.push('/admin/usher/events')}
            className="text-xs text-muted-foreground hover:text-charcoal transition-colors flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Database Penonton
          </button>
          <h1 className="font-serif text-xl font-bold text-charcoal">
            {event.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Peta Kursi — Mode Baca Saja
          </p>
          {/* Multi-day show date tabs */}
          {showDates.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {showDates.map((sd, idx) => (
                <button
                  key={sd.id || idx}
                  onClick={() => {
                    setSelectedShowDateIdx(idx)
                    setSelectedSeat(null)
                    setSelectedSeatCode(null)
                    setInfoSheetOpen(false)
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    idx === selectedShowDateIdx
                      ? 'bg-gold text-charcoal'
                      : 'bg-gray-100 text-muted-foreground hover:bg-gray-200'
                  )}
                >
                  {sd.label || `Hari ${idx + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stage size selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">Ukuran Panggung:</span>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setStageSize('sm')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                stageSize === 'sm'
                  ? 'bg-white shadow-sm text-charcoal'
                  : 'text-muted-foreground hover:text-charcoal'
              )}
            >
              <Minimize2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setStageSize('md')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                stageSize === 'md'
                  ? 'bg-white shadow-sm text-charcoal'
                  : 'text-muted-foreground hover:text-charcoal'
              )}
            >
              S
            </button>
            <button
              onClick={() => setStageSize('lg')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                stageSize === 'lg'
                  ? 'bg-white shadow-sm text-charcoal'
                  : 'text-muted-foreground hover:text-charcoal'
              )}
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Kursi</p>
            <p className="text-lg font-bold text-charcoal">{totalSeats}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Terjual</p>
            <p className="text-lg font-bold text-charcoal">{soldSeats}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Undangan</p>
            <p className="text-lg font-bold text-seat-invitation">{invitationSeats}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Check-In</p>
            <p className="text-lg font-bold text-success">{checkedInSeats}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Tersedia</p>
            <p className="text-lg font-bold text-charcoal">{availableSeats}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Dikunci</p>
            <p className="text-lg font-bold text-seat-locked">{lockedSeats}</p>
          </CardContent>
        </Card>
      </div>

      {/* Seat Map — Full Width */}
      <Card className="border-border/50">
        <CardContent className="p-4 sm:p-6">
          <div className="w-full">
            {/* Seat Grid — scrollable, with stage INSIDE */}
            <div className="overflow-x-auto pb-4">
              <div className="min-w-[320px] px-2">
                {seatGridContent}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded border-2 bg-white" style={{ borderColor: '#C8A951' }} />
                <span>Tersedia</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-seat-sold" />
                <span>Terjual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-success" />
                <span>Sudah Check-In</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-seat-locked" />
                <span>Dikunci</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-seat-invitation" />
                <span>Undangan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-gray-200 opacity-30" />
                <span>Tidak Tersedia</span>
              </div>
            </div>

            {/* Price Category Legend */}
            {priceCategories.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs">
                {priceCategories.map((cat) => {
                  const catConfig = CATEGORY_CONFIG[cat.name]
                  const Icon = catConfig?.icon || User
                  return (
                    <div key={cat.id} className="flex items-center gap-1.5">
                      <Icon className="w-4 h-4" style={{ color: cat.colorCode || catConfig?.defaultColor }} />
                      <span className="text-muted-foreground">{cat.name}</span>
                      <span className="font-medium text-charcoal">Rp {cat.price.toLocaleString('id-ID')}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info hint when no seat selected */}
      {!selectedSeat && !selectedSeatCode && (
        <div className="text-center py-2">
          <p className="text-xs text-muted-foreground/60">
            <Users className="w-4 h-4 inline-block mr-1 -mt-0.5 opacity-40" />
            Klik kursi yang <span className="font-semibold text-muted-foreground/80">terjual</span> atau <span className="font-semibold text-muted-foreground/80">undangan</span> untuk melihat detail penonton
          </p>
        </div>
      )}

      {/* Seat Info Sheet (Side Drawer) */}
      <Sheet open={infoSheetOpen} onOpenChange={(open) => {
        setInfoSheetOpen(open)
        if (!open) {
          setSelectedSeat(null)
          setSelectedSeatCode(null)
          setResendResult(null)
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-3">
            <SheetTitle className="font-serif text-base text-charcoal flex items-center gap-2">
              <Hash className="w-4 h-4 text-gold" />
              {selectedSeatCode}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Detail penonton kursi {selectedSeatCode}
            </SheetDescription>
          </SheetHeader>

          {selectedSeat && (
            <div className="space-y-4 px-4 pb-6">
              {/* Owner Info */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nama Pemesan</p>
                  <p className="text-sm font-semibold text-charcoal">{selectedSeat.owner}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </p>
                  <p className="text-sm text-charcoal break-all">{selectedSeat.email}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Phone className="w-3 h-3" /> WhatsApp
                  </p>
                  <p className="text-sm text-charcoal">{selectedSeat.phone}</p>
                </div>
              </div>

              <div className="zen-divider" />

              {/* Transaction Details */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Transaction ID
                  </p>
                  <p className="text-xs font-mono text-charcoal bg-gray-50 px-2 py-1 rounded break-all">
                    {selectedSeat.transactionId}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Total Pembayaran
                  </p>
                  <p className="text-sm font-semibold text-charcoal">
                    {selectedSeat.totalAmount === 0 ? (
                      <Badge className="bg-seat-invitation/20 text-seat-invitation border-seat-invitation/30 text-xs">
                        Tiket Komplimen
                      </Badge>
                    ) : (
                      `Rp ${selectedSeat.totalAmount.toLocaleString('id-ID')}`
                    )}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status Pembayaran</p>
                  <Badge className="bg-success/10 text-success border-success/20 text-xs">
                    {selectedSeat.paymentStatus}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Status Check-In
                  </p>
                  {selectedSeat.checkInTime ? (
                    <div className="space-y-1">
                      <Badge className="bg-success/10 text-success border-success/20 text-xs">
                        Sudah Check-In
                      </Badge>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(selectedSeat.checkInTime).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                      Belum Check-In
                    </Badge>
                  )}
                </div>

                {selectedSeat.paidAt && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Waktu Bayar</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedSeat.paidAt).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Resend Email */}
              <div className="pt-2 space-y-3">
                <Button
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="w-full bg-gold hover:bg-gold-dark text-charcoal text-sm"
                  size="sm"
                >
                  {isResending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mengirim...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" />Kirim Ulang E-Tiket</>
                  )}
                </Button>
                {resendResult && (
                  <p className={cn(
                    'text-xs text-center py-1.5 px-3 rounded-md',
                    resendResult.success
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  )}>
                    {resendResult.message}
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
