'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Loader2, Save, Check, X, Lock, Crown, RotateCcw, Trash2, RefreshCw, CalendarDays
} from 'lucide-react'
import { StageRenderer, ObjectsOverlay } from '@/lib/stage-renderer'
import { parseLayoutData, type ParsedLayout } from '@/lib/seat-layout'

const CATEGORY_CONFIG: Record<string, { icon: typeof Crown; label: string; defaultColor: string }> = {
  VIP: { icon: Crown, label: 'VIP', defaultColor: '#C8A951' },
  Regular: { icon: Lock, label: 'Regular', defaultColor: '#8B8680' },
  Student: { icon: Crown, label: 'Student', defaultColor: '#7BA7A5' },
}

const SEAT_W = 28
const SEAT_GAP = 3
const LABEL_W = 24 // w-6 = 24px row label area

interface SeatData {
  id: string
  seatCode: string
  status: string
  row: string
  col: number
  priceCategoryId: string | null
  priceCategory: { id: string; name: string; price: number; colorCode: string } | null
  eventShowDateId?: string | null
}

interface PriceCategoryData {
  id: string
  name: string
  price: number
  colorCode: string
}

interface ShowDateData {
  id: string
  date: string
  openGate: string | null
  label: string | null
}

interface EventInfo {
  id: string
  title: string
  seatMapId: string | null
  seatType?: string
  showDates?: ShowDateData[]
}

export default function SeatEditorPage() {
  const params = useParams()
  const eventId = params.id as string

  const [allSeats, setAllSeats] = useState<SeatData[]>([])
  const [priceCategories, setPriceCategories] = useState<PriceCategoryData[]>([])
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null)
  const [layoutData, setLayoutData] = useState<any>(null)
  const [selectedSeatCodes, setSelectedSeatCodes] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [showDates, setShowDates] = useState<ShowDateData[]>([])
  const [selectedShowDateIdx, setSelectedShowDateIdx] = useState(-1) // -1 = all days
  const [isSaving, setIsSaving] = useState(false)
  const [isDeletingSeats, setIsDeletingSeats] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const isDraggingRef = useRef(false)
  const dragModeRef = useRef<'select' | 'deselect'>('select')

  // Active show date
  const activeShowDate = selectedShowDateIdx >= 0 && showDates[selectedShowDateIdx]
    ? showDates[selectedShowDateIdx]
    : null

  // Group seats by showDateId for "Semua Hari" divider view
  const seatsByDate = useMemo(() => {
    if (activeShowDate) return null // Single day mode — no grouping needed
    if (showDates.length <= 1) return null // Only 1 day — no divider needed
    const groups = new Map<string | null, SeatData[]>()
    for (const s of allSeats) {
      const key = s.eventShowDateId || null
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(s)
    }
    return groups
  }, [allSeats, activeShowDate, showDates.length])

  // Filter seats based on selected day — ONLY match explicit showDateId, no orphan fallback
  const seats = useMemo(() => {
    if (!activeShowDate) return allSeats
    return allSeats.filter(s => s.eventShowDateId === activeShowDate.id)
  }, [allSeats, activeShowDate])

  useEffect(() => {
    async function fetchData() {
      try {
        const [seatsRes, eventRes] = await Promise.all([
          fetch(`/api/events/${eventId}/seats`),
          fetch(`/api/admin/events/${eventId}`),
        ])

        if (seatsRes.ok) {
          const data = await seatsRes.json()
          setAllSeats(data.seats || [])
          setPriceCategories(data.priceCategories || [])
        }

        if (eventRes.ok) {
          const data = await eventRes.json()
          const ev = data.event || null
          setEventInfo(ev)
          // Populate show dates
          if (ev?.showDates && ev.showDates.length > 1) {
            setShowDates(ev.showDates)
            setSelectedShowDateIdx(0)
          }
          // Fetch layoutData from the seat map
          if (ev?.seatMapId) {
            try {
              const mapRes = await fetch(`/api/admin/seat-maps/${ev.seatMapId}`)
              if (mapRes.ok) {
                const mapData = await mapRes.json()
                if (mapData.seatMap?.layoutData) {
                  setLayoutData(mapData.seatMap.layoutData)
                }
              }
            } catch { /* ignore */ }
          }
        }
      } catch (err) {
        console.error('Failed to fetch seats:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (eventId) fetchData()
  }, [eventId])

  // Re-fetch seats when active show date changes
  useEffect(() => {
    if (!eventId) return
    const url = activeShowDate
      ? `/api/events/${eventId}/seats?showDateId=${activeShowDate.id}`
      : `/api/events/${eventId}/seats`
    let cancelled = false
    fetch(url)
      .then(res => res.ok ? res.json() : { seats: [], priceCategories: [] })
      .then(data => {
        if (cancelled) return
        setAllSeats(data.seats || [])
        if (data.priceCategories) setPriceCategories(data.priceCategories)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeShowDate?.id, eventId])

  // ─── Parse layoutData for flat grid rendering (1:1 with seat map editor) ──
  const parsedLayout = useMemo(() => parseLayoutData(layoutData) as ParsedLayout | null, [layoutData])

  // ─── Stage & Objects coordinate mapping (canvas → admin grid) ──
  const stageLayout = useMemo(() => {
    if (!parsedLayout) return null
    const { gridSize, displayRows, stagePosition, canvasSeatBounds: csb } = parsedLayout
    const cols = gridSize.cols
    const CELL_TOTAL = SEAT_W + SEAT_GAP
    const guestGridW = cols * CELL_TOTAL
    const guestGridH = displayRows.length * CELL_TOTAL
    const hasBounds = !!csb && cols > 0 && displayRows.length > 0
    const hasCustomStagePos = stagePosition && typeof stagePosition.x === 'number'
    const stageType = parsedLayout.stageType || 'PROSCENIUM'
    const isInsetStage = stageType === 'BLACK_BOX' || stageType === 'ARENA'
    const stageSize: 'sm' | 'md' | 'lg' = isInsetStage ? 'md' : 'lg'

    // Helper: transform canvas (cx, cy, cw, ch) → guest (gx, gy, gw, gh)
    function toGuest(cx: number, cy: number, cw: number, ch: number) {
      if (!csb) return { x: cx, y: cy, w: cw, h: ch }
      return {
        x: LABEL_W + ((cx - csb.originX) / csb.spanX) * guestGridW,
        y: ((cy - csb.originY) / csb.spanY) * guestGridH,
        w: (cw / csb.spanX) * guestGridW,
        h: (ch / csb.spanY) * guestGridH,
      }
    }

    // Calculate paddingTop for elements above the seat grid
    let stageGuest = hasCustomStagePos && hasBounds
      ? toGuest(stagePosition.x, stagePosition.y, stagePosition.width, stagePosition.height)
      : null
    const allGuestYs: number[] = []
    if (stageGuest) allGuestYs.push(stageGuest.y)
    if (parsedLayout.objects) {
      for (const obj of parsedLayout.objects) {
        if (typeof obj.x === 'number' && typeof obj.y === 'number' && hasBounds) {
          const g = toGuest(obj.x, obj.y, obj.pixelW || 60, obj.pixelH || 30)
          allGuestYs.push(g.y)
        }
      }
    }
    const minGuestY = allGuestYs.length > 0 ? Math.min(...allGuestYs) : 0
    const paddingTop = minGuestY < 0 ? Math.ceil(-minGuestY) + 4 : 0

    // Adjust stageGuest.y by paddingTop so the absolute stage renders correctly
    // inside the container that has paddingTop CSS applied.
    // Without this, a negative raw y (stage above seats) would render off-screen.
    if (stageGuest && paddingTop > 0) {
      stageGuest = { ...stageGuest, y: stageGuest.y + paddingTop }
    }

    return {
      stageType,
      isInsetStage,
      stageSize,
      hasCustomStagePos: !!hasCustomStagePos && hasBounds,
      stageGuest,
      paddingTop,
      canvasSeatBounds: csb,
      cols,
      displayRowsCount: displayRows.length,
    }
  }, [parsedLayout])

  // Build seat lookup by seatCode
  const seatLookup = useMemo(() => {
    const map = new Map<string, SeatData>()
    for (const seat of seats) {
      map.set(seat.seatCode, seat)
    }
    return map
  }, [seats])

  // ─── Build dynamic row layout (fallback for GA / no layoutData) ──────
  const rowLayout = useMemo(() => {
    if (seats.length === 0) return []
    if (parsedLayout) return [] // Use parsedLayout instead

    const rowMap = new Map<string, SeatData[]>()
    for (const seat of seats) {
      if (!rowMap.has(seat.row)) rowMap.set(seat.row, [])
      rowMap.get(seat.row)!.push(seat)
    }

    const rowEntries = [...rowMap.entries()].sort((a, b) => {
      if (a[0].length === 1 && b[0].length === 1) return a[0].localeCompare(b[0])
      return (a[1][0]?.col || 0) - (b[1][0]?.col || 0)
    })

    return rowEntries.map(([rowName, rowSeats]) => {
      const sorted = [...rowSeats].sort((a, b) => a.col - b.col)
      return { rowName, seats: sorted, totalSeats: sorted.length }
    })
  }, [seats, parsedLayout])

  // ─── Check if GA (General Admission) type ───────────────────────────
  const isGA = useMemo(() => {
    if (parsedLayout) return false // layoutData means NUMBERED
    if (seats.length === 0) return false
    const uniqueRows = new Set(seats.map(s => s.row))
    return uniqueRows.size <= 5 && seats.length / uniqueRows.size > 10
  }, [seats, parsedLayout])

  // Clear selection when switching days
  useEffect(() => {
    setSelectedSeatCodes(new Set())
    setHasUnsavedChanges(false)
  }, [selectedShowDateIdx])

  // ─── Mouse handlers ─────────────────────────────────────────────────
  const handleMouseDown = useCallback((seat: SeatData) => {
    if (selectedSeatCodes.has(seat.seatCode)) {
      dragModeRef.current = 'deselect'
      setSelectedSeatCodes((prev) => {
        const next = new Set(prev)
        next.delete(seat.seatCode)
        return next
      })
    } else {
      dragModeRef.current = 'select'
      setSelectedSeatCodes((prev) => new Set(prev).add(seat.seatCode))
    }
    isDraggingRef.current = true
  }, [selectedSeatCodes])

  const handleMouseEnter = useCallback((seat: SeatData) => {
    if (!isDraggingRef.current) return

    if (dragModeRef.current === 'select') {
      setSelectedSeatCodes((prev) => new Set(prev).add(seat.seatCode))
    } else {
      setSelectedSeatCodes((prev) => {
        const next = new Set(prev)
        next.delete(seat.seatCode)
        return next
      })
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [handleMouseUp])

  const clearSelection = () => setSelectedSeatCodes(new Set())

  const selectAll = () => {
    setSelectedSeatCodes(new Set(seats.map((s) => s.seatCode)))
  }

  // ─── Seat operations (local state only — use Simpan button to persist) ─
  function assignPriceCategory(priceCategoryId: string) {
    if (selectedSeatCodes.size === 0) return
    setAllSeats((prev) =>
      prev.map((s) =>
        selectedSeatCodes.has(s.seatCode)
          ? { ...s, priceCategoryId, priceCategory: priceCategories.find((pc) => pc.id === priceCategoryId) || null }
          : s
      )
    )
    setHasUnsavedChanges(true)
    clearSelection()
  }

  function setSeatStatus(status: string) {
    if (selectedSeatCodes.size === 0) return
    setAllSeats((prev) =>
      prev.map((s) =>
        selectedSeatCodes.has(s.seatCode) ? { ...s, status } : s
      )
    )
    setHasUnsavedChanges(true)
    clearSelection()
  }

  // ─── Save all changes to server ───────────────────────────────────
  async function saveAllChanges() {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/events/${eventId}/seats`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showDateId: activeShowDate?.id || undefined,
          seats: seats.map((s) => ({
            seatCode: s.seatCode,
            status: s.status,
            priceCategoryId: s.priceCategoryId,
          })),
        }),
      })
      if (res.ok) {
        setHasUnsavedChanges(false)
      } else {
        alert('Gagal menyimpan. Coba lagi.')
      }
    } catch (err) {
      console.error('Save error:', err)
      alert('Gagal menyimpan. Coba lagi.')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Delete & Regenerate ────────────────────────────────────────────
  async function handleDeleteAndRegenerate() {
    const confirmed = confirm(
      `Hapus semua ${seats.length} kursi?\n\nEvent akan kembali ke keadaan belum generate kursi. Kamu bisa generate ulang dari halaman Events.`
    )
    if (!confirmed) return

    setIsDeletingSeats(true)
    try {
      const res = await fetch(`/api/admin/events/${eventId}/seats`, { method: 'DELETE' })
      if (res.ok) {
        setAllSeats([])
        setSelectedSeatCodes(new Set())
      } else {
        const data = await res.json()
        alert(data.error || 'Gagal menghapus kursi')
      }
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setIsDeletingSeats(false)
    }
  }

  // ─── Seat styling ───────────────────────────────────────────────────
  const getSeatStyle = (seat: SeatData) => {
    const isSelected = selectedSeatCodes.has(seat.seatCode)

    switch (seat.status) {
      case 'SOLD':
        return 'bg-seat-sold text-white'
      case 'LOCKED_TEMPORARY':
        return 'bg-seat-locked text-white'
      case 'INVITATION':
        return 'bg-seat-invitation text-white'
      case 'UNAVAILABLE':
        return 'bg-gray-300 opacity-40'
      default:
        if (isSelected) return 'bg-gold text-charcoal ring-2 ring-gold ring-offset-1'
        return 'bg-white border-2'
    }
  }

  const getSeatBorderColor = (seat: SeatData) => {
    if (seat.status !== 'AVAILABLE' || selectedSeatCodes.has(seat.seatCode)) return 'transparent'
    return seat.priceCategory?.colorCode || '#C8A951'
  }

  // ─── Build row layout from seat data (fallback when no parsedLayout) ──
  function buildRowLayout(seatList: SeatData[]) {
    if (seatList.length === 0) return []
    const rowMap = new Map<string, SeatData[]>()
    for (const seat of seatList) {
      if (!rowMap.has(seat.row)) rowMap.set(seat.row, [])
      rowMap.get(seat.row)!.push(seat)
    }
    const rowEntries = [...rowMap.entries()].sort((a, b) => {
      if (a[0].length === 1 && b[0].length === 1) return a[0].localeCompare(b[0])
      return (a[1][0]?.col || 0) - (b[1][0]?.col || 0)
    })
    return rowEntries.map(([rowName, rowSeats]) => {
      const sorted = [...rowSeats].sort((a, b) => a.col - b.col)
      return { rowName, seats: sorted, totalSeats: sorted.length }
    })
  }

  // ─── Render flat grid from layoutData (reusable for multi-day divider) ─
  function renderFlatGridInner(lookup: Map<string, SeatData>) {
    if (!parsedLayout) return null
    const { gridSize, rowLabels: lLabels, rowSeatMap, embeddedRows, displayRows, sections } = parsedLayout
    const { cols } = gridSize
    const aisleColumns = parsedLayout.aisleColumns || []

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
    const middleRowIndex = stageLayout?.isInsetStage && !stageLayout?.hasCustomStagePos
      ? Math.floor(displayRows.length / 2) : -1

    const getRowColor = (rowIdx: number) => {
      const section = sections.find(s => rowIdx >= s.fromRow && rowIdx <= s.toRow)
      if (section) return CATEGORY_CONFIG[section.name]?.defaultColor || section.colorCode
      return '#8B8680'
    }

    return (
      <>
        {displayRows.map((ri, idx) => {
          const label = lLabels[ri] || String.fromCharCode(65 + ri)
          const colMap = gridLookup.get(ri) || new Map()
          const rowColor = getRowColor(ri)

          return (
            <React.Fragment key={ri}>
              {/* Inset stage (BLACK_BOX / ARENA) in middle of rows — only if no custom position */}
              {stageLayout?.isInsetStage && !stageLayout?.hasCustomStagePos && idx === middleRowIndex && (
                <div className="flex justify-center my-2">
                  <StageRenderer
                    stageType={stageLayout.stageType}
                    size={stageLayout.stageSize}
                    thrustWidth={parsedLayout.thrustWidth}
                    thrustDepth={parsedLayout.thrustDepth}
                  />
                </div>
              )}
              <div
                className="flex items-center mb-[3px]"
                style={{ height: SEAT_W }}
              >
                <div className="w-6 text-center text-xs font-semibold font-serif shrink-0" style={{ color: rowColor }}>
                  {label}
                </div>
                <div className="flex items-center" style={{ gap: SEAT_GAP, height: SEAT_W }}>
                  {Array.from({ length: cols }, (_, c) => {
                    if (aisleColumns.includes(c)) {
                      return (
                        <div key={c} className="shrink-0 bg-border/30 rounded-full mx-0.5" style={{ width: 2, height: SEAT_W * 0.6 }} />
                      )
                    }
                    const seatInfo = colMap.get(c)
                    if (seatInfo) {
                      const seatData = lookup.get(seatInfo.seatCode)
                      return renderSeatButton(seatData, seatInfo.seatCode, seatInfo.seatNum)
                    }
                    return <div key={c} style={{ width: SEAT_W, height: SEAT_W }} className="shrink-0" />
                  })}
                </div>
                <div className="w-6 text-center text-xs font-semibold font-serif shrink-0" style={{ color: rowColor }}>
                  {label}
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </>
    )
  }

  // ─── Render seat button ─────────────────────────────────────────────
  const renderSeatButton = (seat: SeatData | undefined, seatCode?: string, displayNum?: number) => {
    if (!seat) {
      // Empty placeholder — position in layoutData but no seat generated
      return (
        <div
          key={seatCode || 'empty'}
          style={{ width: SEAT_W, height: SEAT_W }}
          className="shrink-0 rounded-md bg-gray-100/50 border border-dashed border-gray-200/60 flex items-center justify-center text-[8px] text-gray-300"
        >
          {displayNum}
        </div>
      )
    }

    const num = displayNum ?? seat.col
    return (
      <button
        key={seat.id}
        onMouseDown={(e) => { if (e.button === 0) handleMouseDown(seat) }}
        onMouseEnter={() => handleMouseEnter(seat)}
        className={cn(
          'shrink-0 rounded-md flex items-center justify-center text-[9px] sm:text-[10px] font-medium transition-all duration-100 select-none cursor-pointer',
          getSeatStyle(seat)
        )}
        style={{
          width: SEAT_W,
          height: SEAT_W,
          ...(seat.status === 'AVAILABLE' && !selectedSeatCodes.has(seat.seatCode)
            ? { borderColor: getSeatBorderColor(seat) }
            : {}),
        }}
        title={`${seat.seatCode} | ${seat.priceCategory?.name || '-'} | ${seat.status}`}
      >
        {seat.status === 'SOLD' && <Check className="w-3 h-3" />}
        {seat.status === 'LOCKED_TEMPORARY' && <Lock className="w-3 h-3" />}
        {seat.status === 'UNAVAILABLE' && <X className="w-3 h-3" />}
        {seat.status === 'INVITATION' && <Crown className="w-3 h-3" />}
        {(seat.status === 'AVAILABLE' || selectedSeatCodes.has(seat.seatCode)) && num}
      </button>
    )
  }

  // ─── Loading & Empty states ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gold animate-spin" />
      </div>
    )
  }

  if (allSeats.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Belum ada kursi untuk event ini.</p>
        <p className="text-xs text-muted-foreground/50 mt-1">Generate kursi dari halaman Events terlebih dahulu.</p>
        <a href="/admin/events" className="text-gold underline text-sm mt-4 inline-block">
          ← Kembali ke Events
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - Sticky */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-[#F8F6F3] py-2 -mt-2">
        <div>
          <h1 className="font-serif text-2xl font-bold text-charcoal">Seat Map Editor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {eventInfo?.title && <span className="font-medium">{eventInfo.title}</span>}
            {' — '}
            {seats.length} kursi
            {allSeats.length !== seats.length && <span className="text-muted-foreground/60"> (dari {allSeats.length} total)</span>}
            {selectedSeatCodes.size > 0
              ? ` — ${selectedSeatCodes.size} dipilih`
              : ' — Klik dan drag untuk memilih'}
          </p>
          {/* Multi-day tabs */}
          {showDates.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => setSelectedShowDateIdx(-1)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  selectedShowDateIdx === -1
                    ? 'bg-gold text-charcoal'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                Semua Hari
              </button>
              {showDates.map((sd, idx) => (
                <button
                  key={sd.id || idx}
                  onClick={() => setSelectedShowDateIdx(idx)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    idx === selectedShowDateIdx
                      ? 'bg-gold text-charcoal'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {sd.label || `Hari ${idx + 1}`}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-600 font-medium hidden sm:inline">● Ada perubahan belum disimpan</span>
          )}
          <Button
            size="sm"
            onClick={saveAllChanges}
            disabled={isSaving || !hasUnsavedChanges}
            className={cn(
              "text-sm",
              hasUnsavedChanges
                ? "bg-gold hover:bg-gold/90 text-charcoal font-semibold"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            Simpan
          </Button>
          <Button variant="outline" size="sm" onClick={selectAll}>
            <Check className="w-3 h-3 mr-1" />
            Pilih Semua
          </Button>
          <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedSeatCodes.size === 0}>
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      {selectedSeatCodes.size > 0 && (
        <Card className="border-gold/20 animate-fade-in">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-charcoal">
                Assign ke:
              </span>
              <Select onValueChange={assignPriceCategory}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue placeholder="Kategori Harga" />
                </SelectTrigger>
                <SelectContent>
                  {priceCategories.map((pc) => (
                    <SelectItem key={pc.id} value={pc.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: pc.colorCode }} />
                        {pc.name} (Rp {pc.price.toLocaleString('id-ID')})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Separator orientation="vertical" className="h-6" />

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSeatStatus('INVITATION')}
                className="text-xs"
              >
                <Crown className="w-3 h-3 mr-1" />
                Undangan
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSeatStatus('UNAVAILABLE')}
                className="text-xs"
              >
                <X className="w-3 h-3 mr-1" />
                Tidak Tersedia
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSeatStatus('AVAILABLE')}
                className="text-xs"
              >
                Tersedia
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seat Grid — Dynamic Layout from actual data */}
      <div className="bg-white rounded-xl p-6 border border-border/50">
        <div className="max-w-4xl mx-auto">


          {/* ─── Multi-Day Divider View (Semua Hari) ─── */}
          {seatsByDate && showDates.length > 1 && !activeShowDate ? (
            <div className="space-y-8 mt-4">
              {/* For non-custom-position stages, show once above all days */}
              {stageLayout && !stageLayout.hasCustomStagePos && !stageLayout.isInsetStage && (
                <StageRenderer
                  stageType={stageLayout.stageType}
                  size={stageLayout.stageSize}
                  thrustWidth={parsedLayout?.thrustWidth}
                  thrustDepth={parsedLayout?.thrustDepth}
                />
              )}
              {showDates.map((sd, dayIdx) => {
                const daySeats = allSeats.filter(s => s.eventShowDateId === sd.id || (!s.eventShowDateId && dayIdx === 0))
                const dayLookup = new Map<string, SeatData>()
                for (const s of daySeats) dayLookup.set(s.seatCode, s)
                const dayAvailable = daySeats.filter(s => s.status === 'AVAILABLE').length
                const daySold = daySeats.filter(s => s.status === 'SOLD').length

                return (
                  <div key={sd.id || dayIdx}>
                    {/* Day divider header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-charcoal text-gold">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">{sd.label || `Hari ${dayIdx + 1}`}</span>
                        <Separator orientation="vertical" className="h-3 bg-gold/30" />
                        <span className="text-[10px] text-gold/70">{daySeats.length} kursi</span>
                        <span className="text-[10px] text-gold/50">•</span>
                        <span className="text-[10px] text-emerald-400">{dayAvailable} tersedia</span>
                        <span className="text-[10px] text-gold/50">•</span>
                        <span className="text-[10px] text-red-400">{daySold} terjual</span>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                    </div>

                    {/* Day grid */}
                    <div className="overflow-x-auto pb-2">
                      <div className="min-w-[320px]">
                        {parsedLayout ? (
                          <div className="relative mx-auto w-fit flex flex-col items-center" style={{ minWidth: (() => {
                            const CELL_TOTAL = SEAT_W + SEAT_GAP
                            const cols = parsedLayout.gridSize.cols
                            return cols * CELL_TOTAL - SEAT_GAP + 60
                          })(), paddingTop: stageLayout?.hasCustomStagePos ? stageLayout.paddingTop : 0 }}>
                          {/* Custom stage position — shown per day since relative to grid */}
                            {stageLayout && stageLayout.hasCustomStagePos && stageLayout.stageGuest && (
                              <div
                                className="absolute pointer-events-none"
                                style={{
                                  left: stageLayout.stageGuest.x,
                                  top: stageLayout.stageGuest.y,
                                  width: stageLayout.stageGuest.w,
                                  height: stageLayout.stageGuest.h,
                                  zIndex: 10,
                                }}
                              >
                                <StageRenderer
                                  stageType={stageLayout.stageType}
                                  size={stageLayout.stageSize}
                                  thrustWidth={parsedLayout?.thrustWidth}
                                  thrustDepth={parsedLayout?.thrustDepth}
                                  fillParent
                                />
                              </div>
                            )}
                            {/* Objects overlay for multi-day view */}
                            {parsedLayout?.objects && parsedLayout.objects.length > 0 && stageLayout && (
                              <ObjectsOverlay
                                objects={parsedLayout.objects}
                                cellSize={SEAT_W + SEAT_GAP}
                                offsetX={LABEL_W}
                                canvasSeatBounds={stageLayout.canvasSeatBounds}
                                gridCols={stageLayout.cols}
                                gridRows={stageLayout.displayRowsCount}
                                paddingTop={stageLayout.paddingTop}
                              />
                            )}
                            {renderFlatGridInner(dayLookup)}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {(() => {
                              const dayRowLayout = buildRowLayout(daySeats)
                              return dayRowLayout.map((row) => (
                                <div key={row.rowName} className="flex items-center gap-1 mb-1">
                                  <div className="w-6 text-center text-xs font-semibold font-serif text-muted-foreground shrink-0">
                                    {row.rowName}
                                  </div>
                                  <div className="flex gap-1">
                                    {row.seats.map((seat: SeatData, i: number) => renderSeatButton(seat, undefined, i + 1))}
                                  </div>
                                </div>
                              ))
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
          <>
          {/* ─── Single Day / Normal Grid ─── */}

          {/* Grid */}
          <div className="overflow-x-auto pb-4">
            <div
              className="min-w-[320px]"
              id="admin-grid-wrapper"
            >
              {parsedLayout ? (
                /* Centered wrapper for both stage overlay and grid rows */
                <div className="relative mx-auto w-fit flex flex-col items-center" style={{ minWidth: (() => {
                  const CELL_TOTAL = SEAT_W + SEAT_GAP
                  const cols = parsedLayout.gridSize.cols
                  return cols * CELL_TOTAL - SEAT_GAP + 60
                })(), paddingTop: stageLayout?.hasCustomStagePos ? stageLayout.paddingTop : 0 }}>
                  {/* Inline stage for non-custom-position stages (PROSCENIUM, AMPHITHEATER, THRUST) */}
                  {stageLayout && !stageLayout.hasCustomStagePos && !stageLayout.isInsetStage && (
                    <StageRenderer
                      stageType={stageLayout.stageType}
                      size={stageLayout.stageSize}
                      thrustWidth={parsedLayout?.thrustWidth}
                      thrustDepth={parsedLayout?.thrustDepth}
                    />
                  )}
                  {/* Custom stage position — absolute overlay */}
                  {stageLayout && stageLayout.hasCustomStagePos && stageLayout.stageGuest && (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: stageLayout.stageGuest.x,
                        top: stageLayout.stageGuest.y,
                        width: stageLayout.stageGuest.w,
                        height: stageLayout.stageGuest.h,
                        zIndex: 10,
                      }}
                    >
                      <StageRenderer
                        stageType={stageLayout.stageType}
                        size={stageLayout.stageSize}
                        thrustWidth={parsedLayout?.thrustWidth}
                        thrustDepth={parsedLayout?.thrustDepth}
                        fillParent
                      />
                    </div>
                  )}
                  {renderFlatGridInner(seatLookup)}
                  {/* Objects overlay — inside centered grid container */}
                  {parsedLayout?.objects && parsedLayout.objects.length > 0 && stageLayout && (
                    <ObjectsOverlay
                      objects={parsedLayout.objects}
                      cellSize={SEAT_W + SEAT_GAP}
                      offsetX={LABEL_W}
                      canvasSeatBounds={stageLayout.canvasSeatBounds}
                      gridCols={stageLayout.cols}
                      gridRows={stageLayout.displayRowsCount}
                      paddingTop={stageLayout.paddingTop}
                    />
                  )}
                </div>
              ) : isGA ? (
                /* ─── GA Layout: zones as rows ─────────────────────────── */
                <div className="space-y-4">
                  {rowLayout.map((row) => (
                    <div key={row.rowName}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 text-center text-xs font-semibold font-serif text-muted-foreground">
                          {row.rowName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ({row.totalSeats} kursi)
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 ml-8">
                        {(row as any).seats.map((seat: SeatData) => renderSeatButton(seat, undefined, undefined))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ─── Fallback: simple row list ────────────────────────── */
                <>
                  {rowLayout.map((row) => (
                    <div key={row.rowName} className="flex items-center gap-1 mb-1">
                      <div className="w-6 text-center text-xs font-semibold font-serif text-muted-foreground shrink-0">
                        {row.rowName}
                      </div>
                      <div className="flex gap-1">
                        {(row as any).seats.map((seat: SeatData, i: number) => renderSeatButton(seat, undefined, i + 1))}
                      </div>
                    </div>
                  ))}
                </>
              )}

            </div>
          </div>
          </>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <Card className="border-danger/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-danger">Hapus Semua Kursi</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hapus semua kursi event ini untuk regenerate ulang dari seat map.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteAndRegenerate}
              disabled={isDeletingSeats}
              className="text-danger border-danger/30 hover:bg-danger/10"
            >
              {isDeletingSeats ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3 mr-1" />
              )}
              Hapus Kursi
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
