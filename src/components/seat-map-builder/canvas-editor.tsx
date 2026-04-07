'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Lock,
  Save,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Plus,
  Minus,
  GripVertical,
  Trash2,
  Edit3,
  Square,
  DoorOpen,
  Move,
  Maximize2,
  Palette,
  Users,
  ChevronDown,
  ChevronRight,
  Clock,
  X,
  AlertTriangle,
  Sparkles,
  Copy,
  Shapes,
  Unlock,
  Paintbrush,
  Magnet,
  MousePointer2,
} from 'lucide-react'
import { StageRenderer, ObjectsOverlay, type StageType } from '@/lib/stage-renderer'
import { DraggableObject, boundsOverlap, type Bounds } from '@/lib/draggable-object'
import { useToast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface LayoutObject {
  id: string
  type: 'FOH' | 'ENTRANCE' | 'CUSTOM_SHAPE'
  label: string
  r: number
  c: number
  w: number
  h: number
  color: string
  x?: number
  y?: number
  pixelW?: number
  pixelH?: number
}

interface CanvasEditorProps {
  seatMapId: string
  seatType: 'NUMBERED' | 'GENERAL_ADMISSION'
  initialLayoutData: any
  initialStageType?: string
  adminId: string
  adminName: string
  onSaveAndExit: (layoutData: any, stageType: string) => void
}

interface SeatPosition {
  r: number
  c: number
}

interface Section {
  name: string
  fromRow: number
  toRow: number
  colorCode: string
}

interface Zone {
  id: string
  name: string
  r: number
  c: number
  w: number
  h: number
  capacity: number
  colorCode: string
}

interface GridSize {
  rows: number
  cols: number
}

// Paint mode types
interface PaintedSeat {
  id: string
  x: number
  y: number
  seatNum: number
}

interface SeatColumn {
  id: string
  label: string
  color: string
  seats: PaintedSeat[]
}

interface NumberedLayout {
  type: 'NUMBERED'
  gridSize: GridSize
  aisleColumns: number[]
  rowLabels: string[]
  seats: SeatPosition[]
  sections: Section[]
  embeddedRows?: Record<string, number>
  objects?: LayoutObject[]
  // Paint mode data
  seatColumns?: SeatColumn[]
  canvasWidth?: number
  canvasHeight?: number
}

interface GALayout {
  type: 'GENERAL_ADMISSION'
  gridSize: GridSize
  zones: Zone[]
  objects?: LayoutObject[]
}

type LayoutData = NumberedLayout | GALayout

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

const MAX_HISTORY = 20
const AUTOSAVE_INTERVAL = 60000
const CELL_SIZE = 28
const MIN_GRID = 1
const MAX_GRID = 30
const SNAP_GRID_SIZE = 32
const MAX_SEATS_PER_COLUMN = 64
const PAINTED_SEAT_SIZE = 28
const maxColFromSeats = (s: any[]) => s.length > 0 ? Math.max(...s.map((seat: any) => seat.c)) + 1 : 1
const maxRowFromSeats = (s: any[]) => s.length > 0 ? Math.max(...s.map((seat: any) => seat.r)) + 1 : 1
const DEFAULT_CANVAS_W = 640
const DEFAULT_CANVAS_H = 480
const MIN_CANVAS = 320
const MAX_CANVAS = 2000

const DEFAULT_COLORS = [
  '#C8A951', '#8B8680', '#7BA7A5', '#A08635',
  '#8B6BAE', '#C75050', '#4A7C59', '#D4843E',
  '#5B8DBE', '#D4A574',
]

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

function seatKey(r: number, c: number) {
  return `${r},${c}`
}

function generateId() {
  return 'z' + Math.random().toString(36).substring(2, 8)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function getNextColumnLabel(existing: string[]): string {
  const used = new Set(existing)
  for (let i = 0; i < 26; i++) {
    const label = String.fromCharCode(65 + i)
    if (!used.has(label)) return label
  }
  return 'Z'
}

function sortColumnsByAvgY(columns: SeatColumn[]): SeatColumn[] {
  return [...columns].sort((a, b) => {
    const avgYA = a.seats.length > 0 ? a.seats.reduce((s, seat) => s + seat.y, 0) / a.seats.length : 0
    const avgYB = b.seats.length > 0 ? b.seats.reduce((s, seat) => s + seat.y, 0) / b.seats.length : 0
    return avgYA - avgYB
  })
}

function deriveGridSeats(columns: SeatColumn[]): { seats: SeatPosition[]; rowLabels: string[] } {
  const SNAP = SNAP_GRID_SIZE

  // Collect all painted seats from all columns
  const allSeats: { x: number; y: number; colLabel: string; colIdx: number }[] = []
  columns.forEach((col, idx) => {
    col.seats.forEach(seat => {
      allSeats.push({ x: seat.x, y: seat.y, colLabel: col.label, colIdx: idx })
    })
  })

  if (allSeats.length === 0) return { seats: [], rowLabels: [] }

  // Determine whether to use column-per-row mapping or position-based derivation.
  // Column-per-row works when each column represents one horizontal row (seats at a
  // single Y position). It breaks when seats are spread across multiple Y values
  // within a column (e.g., user painted seats freely into a single column).
  const uniqueYCount = new Set(allSeats.map(s => s.y)).size
  const usePositionBased = columns.length < 2 || columns.length !== uniqueYCount

  if (!usePositionBased) {
    // ── Column-per-row mapping (safe path for well-structured data) ──
    const sorted = sortColumnsByAvgY(columns)
    const rowLabels = sorted.map(col => col.label)

    const rawSeats: { r: number; c: number }[] = []
    sorted.forEach((col, rIdx) => {
      col.seats.forEach(seat => {
        rawSeats.push({ r: rIdx, c: Math.round(seat.x / SNAP) })
      })
    })

    const minC = rawSeats.length > 0 ? Math.min(...rawSeats.map(s => s.c)) : 0
    const shifted = rawSeats.map(s => ({ r: s.r, c: s.c - minC }))

    const seats: SeatPosition[] = []
    const usedCPerRow = new Map<number, Set<number>>()
    for (const s of shifted) {
      const used = usedCPerRow.get(s.r) || new Set<number>()
      let c = s.c
      while (used.has(c)) c++
      used.add(c)
      seats.push({ r: s.r, c })
      usedCPerRow.set(s.r, used)
    }

    return { seats, rowLabels }
  }

  // ── Position-based 2D grid derivation ──
  // Groups seats by snapped Y position (rows), then by X position (columns).
  // This handles cases where seats are painted freely across the canvas,
  // e.g., all seats in a single column at various Y positions.

  // Group by snapped Y position
  const rowMap = new Map<number, typeof allSeats>()
  for (const s of allSeats) {
    const yKey = Math.round(s.y / SNAP)
    if (!rowMap.has(yKey)) rowMap.set(yKey, [])
    rowMap.get(yKey)!.push(s)
  }

  // Sort rows top-to-bottom
  const sortedYKeys = [...rowMap.keys()].sort((a, b) => a - b)

  // Global min X for column offset normalization
  const allXKeys = allSeats.map(s => Math.round(s.x / SNAP))
  const minX = Math.min(...allXKeys)

  const seats: SeatPosition[] = []
  const rowLabels: string[] = []

  for (const yKey of sortedYKeys) {
    const rowSeats = rowMap.get(yKey)!
    const rowIdx = rowLabels.length

    // Sort seats within row by X position (left to right)
    rowSeats.sort((a, b) => a.x - b.x)

    // Assign column positions with dedup
    const usedC = new Set<number>()
    for (const s of rowSeats) {
      let c = Math.round(s.x / SNAP) - minX
      while (usedC.has(c)) c++
      usedC.add(c)
      seats.push({ r: rowIdx, c })
    }

    // Auto-generate row labels (A, B, C…) since column labels don't map 1:1 to rows
    rowLabels.push(String.fromCharCode(65 + rowIdx))
  }

  return { seats, rowLabels }
}

function getDefaultLayout(type: 'NUMBERED' | 'GENERAL_ADMISSION'): LayoutData {
  if (type === 'NUMBERED') {
    return {
      type: 'NUMBERED',
      gridSize: { rows: 1, cols: 20 },
      aisleColumns: [],
      rowLabels: [],
      seats: [],
      sections: [],
      seatColumns: [],
      canvasWidth: DEFAULT_CANVAS_W,
      canvasHeight: DEFAULT_CANVAS_H,
    }
  }
  return {
    type: 'GENERAL_ADMISSION',
    gridSize: { rows: 12, cols: 16 },
    zones: [],
  }
}

function normalizeLayoutData(raw: any, fallbackType: 'NUMBERED' | 'GENERAL_ADMISSION'): LayoutData {
  if (!raw || typeof raw !== 'object') {
    return getDefaultLayout(fallbackType)
  }

  const type = raw.type === 'GENERAL_ADMISSION' ? 'GENERAL_ADMISSION' as const : 'NUMBERED' as const
  const gridSize = (raw.gridSize && typeof raw.gridSize === 'object')
    ? { rows: Number(raw.gridSize.rows) || 1, cols: Number(raw.gridSize.cols) || 1 }
    : { rows: 8, cols: 10 }

  if (type === 'NUMBERED') {
    const aisleColumns = Array.isArray(raw.aisleColumns) ? raw.aisleColumns : []
    const sections = Array.isArray(raw.sections) ? raw.sections : []
    const embeddedRows = (raw.embeddedRows && typeof raw.embeddedRows === 'object')
      ? raw.embeddedRows
      : undefined

    // Check if paint data exists
    if (Array.isArray(raw.seatColumns) && raw.seatColumns.length > 0) {
      const derived = deriveGridSeats(raw.seatColumns)

      // Check if existing saved seats are consistent with the derived grid.
      // If existing seats have fewer rows than derived (e.g., all r=0 when there
      // should be 7 rows), the saved data was created by a buggy deriveGridSeats
      // and must be re-derived from seatColumns.
      const hasExistingSeats = Array.isArray(raw.seats) && raw.seats.length > 0
      const hasExistingLabels = Array.isArray(raw.rowLabels) && raw.rowLabels.length > 0
      const existingMaxRow = hasExistingSeats ? Math.max(...raw.seats.map((s: any) => s.r ?? 0)) + 1 : 0
      const derivedMaxRow = derived.seats.length > 0 ? Math.max(...derived.seats.map(s => s.r)) + 1 : 0
      const needsReDerive = hasExistingSeats && derivedMaxRow > existingMaxRow

      let seats = (hasExistingSeats && !needsReDerive) ? raw.seats : derived.seats
      const rowLabels = (hasExistingLabels && !needsReDerive) ? raw.rowLabels : derived.rowLabels

      // Deduplicate existing seats: if two seats in the same row share the
      // same c value, shift the later ones right.  This heals data that was
      // saved before the dedup fix in deriveGridSeats.
      if (hasExistingSeats) {
        const deduped: typeof seats = []
        const usedCPerRow = new Map<number, Set<number>>()
        for (const s of seats) {
          const used = usedCPerRow.get(s.r) || new Set<number>()
          let c = s.c
          while (used.has(c)) c++
          used.add(c)
          deduped.push({ r: s.r, c })
          usedCPerRow.set(s.r, used)
        }
        seats = deduped
      }

      // gridSize should match the actual seat spread, not column count.
      // Use the max row index + 1 from seat data for accurate row count.
      const maxCol = seats.length > 0 ? Math.max(...seats.map(s => s.c)) + 1 : 1
      const maxRow = seats.length > 0 ? Math.max(...seats.map(s => s.r)) + 1 : 1
      return {
        type: 'NUMBERED',
        gridSize: {
          rows: maxRow,
          cols: maxCol,
        },
        aisleColumns,
        rowLabels,
        seats,
        sections,
        embeddedRows,
        seatColumns: raw.seatColumns,
        canvasWidth: Number(raw.canvasWidth) || DEFAULT_CANVAS_W,
        canvasHeight: Number(raw.canvasHeight) || DEFAULT_CANVAS_H,
      }
    }

    // Old format: convert grid seats to paint columns
    const oldSeats = Array.isArray(raw.seats) ? raw.seats : []
    const oldRowLabels = Array.isArray(raw.rowLabels) ? raw.rowLabels : []

    if (oldSeats.length > 0) {
      const rowMap = new Map<number, SeatPosition[]>()
      for (const s of oldSeats) {
        if (!rowMap.has(s.r)) rowMap.set(s.r, [])
        rowMap.get(s.r)!.push(s)
      }

      const seatColumns: SeatColumn[] = []
      const rowIndices = [...rowMap.keys()].sort((a, b) => a - b)

      for (const r of rowIndices) {
        const seatsInRow = rowMap.get(r)!.sort((a, b) => a.c - b.c)
        const label = oldRowLabels[r] || String.fromCharCode(65 + (r % 26))
        const colSeats: PaintedSeat[] = seatsInRow.map((s, idx) => ({
          id: generateId(),
          x: s.c * SNAP_GRID_SIZE,
          y: r * SNAP_GRID_SIZE,
          seatNum: idx + 1,
        }))
        seatColumns.push({
          id: generateId(),
          label,
          color: DEFAULT_COLORS[seatColumns.length % DEFAULT_COLORS.length],
          seats: colSeats,
        })
      }

      const derivedLabels = seatColumns.map(c => c.label)
      while (derivedLabels.length < gridSize.rows) {
        derivedLabels.push(String.fromCharCode(65 + (derivedLabels.length % 26)))
      }

      return {
        type: 'NUMBERED',
        gridSize: {
          rows: maxRowFromSeats(oldSeats),
          cols: maxColFromSeats(oldSeats),
        },
        seats: oldSeats,
        aisleColumns,
        rowLabels: derivedLabels,
        sections,
        embeddedRows,
        seatColumns,
        canvasWidth: maxColFromSeats(oldSeats) * SNAP_GRID_SIZE,
        canvasHeight: maxRowFromSeats(oldSeats) * SNAP_GRID_SIZE,
      }
    }

    // Empty layout — preserve canvasWidth/canvasHeight even without seat columns
    const rowLabels = Array.isArray(raw.rowLabels) ? raw.rowLabels : []
    return {
      type: 'NUMBERED',
      gridSize,
      seats: [],
      aisleColumns,
      rowLabels,
      sections,
      embeddedRows,
      seatColumns: raw.seatColumns || [],
      canvasWidth: Number(raw.canvasWidth) || DEFAULT_CANVAS_W,
      canvasHeight: Number(raw.canvasHeight) || DEFAULT_CANVAS_H,
    }
  }

  const zones = Array.isArray(raw.zones) ? raw.zones : []
  return {
    type: 'GENERAL_ADMISSION',
    gridSize,
    zones,
  }
}

// ═══════════════════════════════════════════
// Error Boundary
// ═══════════════════════════════════════════

class SectionBoundary extends React.Component<
  { children: React.ReactNode; name: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; name: string }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[SectionBoundary:${this.props.name}]`, error.message, info.componentStack)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 12 }}>
          <strong>Error ({this.props.name}):</strong> {this.state.error?.message}
        </div>
      )
    }
    return this.props.children
  }
}

// ═══════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════

export function CanvasEditor({
  seatMapId,
  seatType,
  initialLayoutData,
  initialStageType,
  adminId,
  adminName,
  onSaveAndExit,
}: CanvasEditorProps) {
  const { toast } = useToast()
  console.log('[CanvasEditor] initialLayoutData:', initialLayoutData ? JSON.stringify(initialLayoutData).slice(0, 200) : 'null')
  console.log('[CanvasEditor] seatType:', seatType)
  console.log('[CanvasEditor] initialStageType:', initialStageType)

  // ─── State ─────────────────────────────
  const [stageType, setStageType] = useState<StageType>((initialStageType as StageType) || 'PROSCENIUM')
  const [thrustWidth, setThrustWidth] = useState<number>(() => {
    try { return (initialLayoutData as any)?.thrustWidth || 45 } catch { return 45 }
  })
  const [thrustDepth, setThrustDepth] = useState<number>(() => {
    try { return (initialLayoutData as any)?.thrustDepth || 3 } catch { return 3 }
  })
  const [layoutData, setLayoutData] = useState<LayoutData>(() => {
    try {
      if (initialLayoutData && typeof initialLayoutData === 'object') {
        const normalized = normalizeLayoutData(deepClone(initialLayoutData), seatType)
        console.log('[CanvasEditor] Normalized OK, type:', normalized.type)
        return normalized
      }
    } catch (err) {
      console.error('[CanvasEditor] Failed to normalize initialLayoutData:', err)
    }
    return getDefaultLayout(seatType)
  })

  const [renderError, setRenderError] = useState<string | null>(null)

  // Objects state
  const [objects, setObjects] = useState<LayoutObject[]>(() => {
    try {
      if (initialLayoutData?.objects && Array.isArray(initialLayoutData.objects)) {
        return initialLayoutData.objects as LayoutObject[]
      }
    } catch { /* ignore */ }
    return []
  })
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [selectedElementType, setSelectedElementType] = useState<'stage' | 'object' | null>(null)

  // Stage position state
  const [stagePosition, setStagePosition] = useState<Bounds>(() => {
    try {
      const sp = (initialLayoutData as any)?.stagePosition
      if (sp && typeof sp === 'object' && typeof sp.x === 'number') {
        return sp as Bounds
      }
    } catch { /* ignore */ }
    return { x: 0, y: 0, width: 320, height: 60 }
  })

  const [isPreview, setIsPreview] = useState(false)
  const [elementsLocked, setElementsLocked] = useState(false)
  const [autoSaveTime, setAutoSaveTime] = useState<Date | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)

  // Section editing state (NUMBERED)
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [sectionForm, setSectionForm] = useState({ name: '', fromRow: 0, toRow: 0, colorCode: '#C8A951' })

  // Object editing state
  const [objectDialogOpen, setObjectDialogOpen] = useState(false)
  const [editingObject, setEditingObject] = useState<LayoutObject | null>(null)
  const [objectForm, setObjectForm] = useState({ label: '', type: 'CUSTOM_SHAPE' as LayoutObject['type'], r: 0, c: 0, w: 2, h: 1, color: '#6B7280' })

  // Zone editing state (GA)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [isDraggingZone, setIsDraggingZone] = useState(false)
  const [isCreatingZone, setIsCreatingZone] = useState(false)
  const [isResizingZone, setIsResizingZone] = useState(false)
  const [zoneDragStart, setZoneDragStart] = useState<{ x: number; y: number } | null>(null)
  const [zoneCreateStart, setZoneCreateStart] = useState<{ r: number; c: number } | null>(null)
  const [zoneResizeHandle, setZoneResizeHandle] = useState<string | null>(null)

  // Paint mode UI state (NUMBERED) - not stored in history
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null)
  const [magneticMode, setMagneticMode] = useState(true)

  // GA zone refs
  const isCreatingZoneRef = useRef(false)
  const zoneCreateStartRef = useRef<{ r: number; c: number } | null>(null)
  const isDraggingZoneRef = useRef(false)
  const zoneDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const isResizingZoneRef = useRef(false)
  const zoneResizeHandleRef = useRef<string | null>(null)
  const selectedZoneIdRef = useRef<string | null>(null)

  // ─── Refs ──────────────────────────────
  const historyRef = useRef<LayoutData[]>([])
  const historyIndexRef = useRef(-1)
  const isUndoRedoRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const paintCanvasRef = useRef<HTMLDivElement>(null)
  const currentCellRef = useRef<{ r: number; c: number } | null>(null)
  // Paint drag refs
  const isPaintDraggingRef = useRef(false)
  const lastPaintedPosRef = useRef<string | null>(null)

  // ─── Computed ──────────────────────────
  const safeLayoutData: LayoutData = useMemo(() => {
    try {
      if (layoutData && typeof layoutData === 'object' && layoutData.type) {
        return layoutData as LayoutData
      }
    } catch (e) {
      console.error('[CanvasEditor] safeLayoutData error:', e)
    }
    return getDefaultLayout(seatType)
  }, [layoutData, seatType])

  const isNumbered = safeLayoutData.type === 'NUMBERED'
  const gridSize = useMemo(() => {
    try {
      if (safeLayoutData.gridSize && typeof safeLayoutData.gridSize === 'object') {
        return {
          rows: Math.max(1, Math.min(MAX_GRID, Number(safeLayoutData.gridSize.rows) || 1)),
          cols: Math.max(1, Math.min(MAX_GRID, Number(safeLayoutData.gridSize.cols) || 1)),
        }
      }
    } catch (e) {
      console.error('[CanvasEditor] gridSize error:', e)
    }
    return { rows: 8, cols: 10 }
  }, [safeLayoutData])

  // Paint columns from layoutData
  const seatColumns = useMemo((): SeatColumn[] => {
    if (safeLayoutData.type !== 'NUMBERED') return []
    const cols = (safeLayoutData as NumberedLayout).seatColumns
    return Array.isArray(cols) ? cols : []
  }, [safeLayoutData])

  const canvasWidth = useMemo(() => {
    if (safeLayoutData.type !== 'NUMBERED') return DEFAULT_CANVAS_W
    return Number((safeLayoutData as NumberedLayout).canvasWidth) || DEFAULT_CANVAS_W
  }, [safeLayoutData])

  const canvasHeight = useMemo(() => {
    if (safeLayoutData.type !== 'NUMBERED') return DEFAULT_CANVAS_H
    return Number((safeLayoutData as NumberedLayout).canvasHeight) || DEFAULT_CANVAS_H
  }, [safeLayoutData])

  // Section color lookup
  const sectionColorMap = useMemo(() => {
    if (safeLayoutData.type !== 'NUMBERED') return new Map<number, string>()
    const sections = Array.isArray(safeLayoutData.sections) ? safeLayoutData.sections : []
    const map = new Map<number, string>()
    for (const sec of sections) {
      for (let r = sec.fromRow; r <= sec.toRow; r++) {
        map.set(r, sec.colorCode)
      }
    }
    return map
  }, [safeLayoutData])

  // Seat count
  const totalSeats = useMemo(() => {
    if (safeLayoutData.type === 'NUMBERED') {
      const cols = (safeLayoutData as NumberedLayout).seatColumns
      if (Array.isArray(cols) && cols.length > 0) {
        return cols.reduce((sum, col) => sum + col.seats.length, 0)
      }
      return (Array.isArray(safeLayoutData.seats) ? safeLayoutData.seats : []).length
    }
    return (Array.isArray((safeLayoutData as GALayout).zones) ? (safeLayoutData as GALayout).zones : []).reduce((sum, z) => sum + (z?.capacity || 0), 0)
  }, [safeLayoutData])

  // Selected zone (GA)
  const selectedZone = useMemo(() => {
    if (safeLayoutData.type !== 'GENERAL_ADMISSION') return null
    const zones = Array.isArray((safeLayoutData as GALayout).zones) ? (safeLayoutData as GALayout).zones : []
    return zones.find((z) => z.id === selectedZoneId) || null
  }, [safeLayoutData, selectedZoneId])

  // Selected column
  const selectedColumn = useMemo(() => {
    return seatColumns.find(c => c.id === selectedColumnId) || null
  }, [seatColumns, selectedColumnId])

  // ─── Object CRUD ─────────────────────
  const addObject = useCallback((type: LayoutObject['type']) => {
    const defaults: Partial<LayoutObject> = {
      FOH: { label: 'FOH', color: '#E5C07B', w: 4, h: 1 },
      ENTRANCE: { label: 'Pintu Masuk', color: '#61AFEF', w: 1, h: 2 },
      CUSTOM_SHAPE: { label: 'Objek Baru', color: '#6B7280', w: 2, h: 2 },
    }[type]

    const cellPx = CELL_SIZE + 2
    const newObject: LayoutObject = {
      id: generateId(),
      type,
      label: defaults?.label || 'Objek',
      r: 0, c: 0,
      w: defaults?.w || 2, h: defaults?.h || 1,
      color: defaults?.color || '#6B7280',
      x: 0, y: 0,
      pixelW: (defaults?.w || 2) * cellPx,
      pixelH: (defaults?.h || 1) * cellPx,
    }
    setObjects((prev) => [...prev, newObject])
    setSelectedObjectId(newObject.id)
    setSelectedElementType('object')
  }, [])

  const updateObject = useCallback((id: string, updates: Partial<LayoutObject>) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)))
  }, [])

  const deleteObject = useCallback((id: string) => {
    setObjects((prev) => prev.filter((o) => o.id !== id))
    if (selectedObjectId === id) setSelectedObjectId(null)
  }, [selectedObjectId])

  const openEditObjectDialog = useCallback((obj: LayoutObject) => {
    setEditingObject(obj)
    setObjectForm({ label: obj.label, type: obj.type, r: obj.r, c: obj.c, w: obj.w, h: obj.h, color: obj.color })
    setObjectDialogOpen(true)
  }, [])

  const handleSaveObject = useCallback(() => {
    if (!editingObject) return
    updateObject(editingObject.id, {
      label: objectForm.label, type: objectForm.type,
      r: objectForm.r, c: objectForm.c, w: objectForm.w, h: objectForm.h, color: objectForm.color,
    })
    setObjectDialogOpen(false)
  }, [editingObject, objectForm, updateObject])

  const selectedObject = useMemo(() => {
    return objects.find((o) => o.id === selectedObjectId) || null
  }, [objects, selectedObjectId])

  // ─── Stage/Object Selection ──────────
  const handleSelectStage = useCallback(() => {
    setSelectedElementType('stage')
    setSelectedObjectId(null)
  }, [])

  const handleSelectObject = useCallback((id: string) => {
    setSelectedElementType('object')
    setSelectedObjectId(id)
  }, [])

  const handleDeselectAll = useCallback(() => {
    setSelectedElementType(null)
    setSelectedObjectId(null)
  }, [])

  // ─── Overlap Detection ───────────────
  const stageIsOverlapping = useMemo(() => {
    if (selectedElementType !== 'stage' || objects.length === 0) return false
    const stageBounds = stagePosition
    return objects.some((obj) => {
      if (obj.x === undefined || obj.y === undefined) return false
      const objBounds = { x: obj.x, y: obj.y, width: obj.pixelW || obj.w * (CELL_SIZE + 2), height: obj.pixelH || obj.h * (CELL_SIZE + 2) }
      return boundsOverlap(stageBounds, objBounds)
    })
  }, [selectedElementType, stagePosition, objects])

  const objectOverlapIds = useMemo(() => {
    if (selectedElementType !== 'object' || !selectedObjectId) return new Set<string>()
    const selObj = objects.find((o) => o.id === selectedObjectId)
    if (!selObj || selObj.x === undefined || selObj.y === undefined) return new Set<string>()
    const selBounds: Bounds = { x: selObj.x, y: selObj.y, width: selObj.pixelW || selObj.w * (CELL_SIZE + 2), height: selObj.pixelH || selObj.h * (CELL_SIZE + 2) }
    const overlaps = new Set<string>()
    if (boundsOverlap(selBounds, stagePosition)) overlaps.add('__stage__')
    for (const obj of objects) {
      if (obj.id === selectedObjectId || obj.x === undefined || obj.y === undefined) continue
      const objBounds: Bounds = { x: obj.x, y: obj.y, width: obj.pixelW || obj.w * (CELL_SIZE + 2), height: obj.pixelH || obj.h * (CELL_SIZE + 2) }
      if (boundsOverlap(selBounds, objBounds)) overlaps.add(obj.id)
    }
    return overlaps
  }, [selectedElementType, selectedObjectId, objects, stagePosition])

  // ─── History (Undo/Redo) ───────────────
  const pushHistory = useCallback((newData: LayoutData) => {
    if (isUndoRedoRef.current) return
    const history = historyRef.current
    const idx = historyIndexRef.current
    if (idx < history.length - 1) {
      historyRef.current = history.slice(0, idx + 1)
    }
    historyRef.current.push(deepClone(newData))
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    } else {
      historyIndexRef.current = historyRef.current.length - 1
    }
  }, [])

  const undo = useCallback(() => {
    const idx = historyIndexRef.current
    if (idx <= 0) return
    isUndoRedoRef.current = true
    historyIndexRef.current = idx - 1
    const restored = deepClone(historyRef.current[idx - 1])
    setLayoutData(restored)
    // Sync selected column with restored data
    const cols = (restored as NumberedLayout).seatColumns
    if (Array.isArray(cols) && cols.length > 0) {
      const currentId = selectedColumnId
      const stillExists = cols.some(c => c.id === currentId)
      if (!stillExists) setSelectedColumnId(cols[0].id)
    }
    setTimeout(() => { isUndoRedoRef.current = false }, 0)
  }, [selectedColumnId])

  const redo = useCallback(() => {
    const idx = historyIndexRef.current
    if (idx >= historyRef.current.length - 1) return
    isUndoRedoRef.current = true
    historyIndexRef.current = idx + 1
    const restored = deepClone(historyRef.current[idx + 1])
    setLayoutData(restored)
    const cols = (restored as NumberedLayout).seatColumns
    if (Array.isArray(cols) && cols.length > 0) {
      const currentId = selectedColumnId
      const stillExists = cols.some(c => c.id === currentId)
      if (!stillExists) setSelectedColumnId(cols[0].id)
    }
    setTimeout(() => { isUndoRedoRef.current = false }, 0)
  }, [selectedColumnId])

  const canUndo = historyIndexRef.current > 0
  const canRedo = historyIndexRef.current < historyRef.current.length - 1

  const hasInitializedRef = useRef(false)
  useEffect(() => {
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true
    pushHistory(layoutData)
    // Auto-select first column if available
    const cols = (layoutData as NumberedLayout).seatColumns
    if (Array.isArray(cols) && cols.length > 0) {
      setSelectedColumnId(cols[0].id)
    }
  }, [layoutData, pushHistory])

  // ─── Keyboard Shortcuts ────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undo()
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // ─── Auto-Save ─────────────────────────
  const performAutoSave = useCallback(async () => {
    setIsAutoSaving(true)
    try {
      // CRITICAL: Include objects and stagePosition in auto-save.
      // Without these, auto-save overwrites the DB with layoutData that
      // lacks object/stage position data, causing positions to reset on reload.
      const autoSaveData = deepClone(layoutData)
      autoSaveData.objects = deepClone(objects)
      autoSaveData.stageType = stageType
      autoSaveData.stagePosition = stagePosition
      if (stageType === 'THRUST') {
        autoSaveData.thrustWidth = thrustWidth
        autoSaveData.thrustDepth = thrustDepth
      }
      const res = await fetch(`/api/admin/seat-maps/${seatMapId}/autosave`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutData: autoSaveData, adminId }),
      })
      if (res.ok) setAutoSaveTime(new Date())
    } catch { /* silent */ } finally { setIsAutoSaving(false) }
  }, [seatMapId, layoutData, objects, stageType, stagePosition, thrustWidth, thrustDepth, adminId])

  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => { performAutoSave() }, AUTOSAVE_INTERVAL)
    return () => { if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current) }
  }, [performAutoSave])

  const resetAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setInterval(() => { performAutoSave() }, AUTOSAVE_INTERVAL)
  }, [performAutoSave])

  // ─── Release Lock on Unmount ───────────
  useEffect(() => {
    return () => {
      fetch(`/api/admin/seat-maps/${seatMapId}/lock`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId }),
      }).catch(() => {})
    }
  }, [seatMapId, adminId])

  // ═════════════════════════════════════════
  // NUMBERED Mode - Paint Handlers
  // ═════════════════════════════════════════

  const updateLayout = useCallback(
    (updater: (prev: LayoutData) => LayoutData) => {
      setLayoutData((prev) => {
        const next = updater(prev)
        pushHistory(next)
        resetAutoSaveTimer()
        return next
      })
    },
    [pushHistory, resetAutoSaveTimer]
  )

  // Add a new column
  const handleAddColumn = useCallback(() => {
    const currentCols = seatColumns
    if (currentCols.length >= 26) {
      toast({ title: 'Batas Kolom', description: 'Maksimal 26 kolom (A–Z).', variant: 'destructive' })
      return
    }
    const label = getNextColumnLabel(currentCols.map(c => c.label))
    const newCol: SeatColumn = {
      id: generateId(),
      label,
      color: DEFAULT_COLORS[currentCols.length % DEFAULT_COLORS.length],
      seats: [],
    }
    updateLayout(prev => {
      if (prev.type !== 'NUMBERED') return prev
      const updatedCols = [...(prev.seatColumns || []), newCol]
      const { seats, rowLabels } = deriveGridSeats(updatedCols)
      return {
        ...prev,
        seatColumns: updatedCols,
        seats,
        rowLabels,
        gridSize: {
          rows: maxRowFromSeats(seats),
          cols: maxColFromSeats(seats),
        },
      }
    })
    setSelectedColumnId(newCol.id)
  }, [seatColumns, updateLayout, toast])

  // Delete a column
  const handleDeleteColumn = useCallback((colId: string) => {
    updateLayout(prev => {
      if (prev.type !== 'NUMBERED') return prev
      const updatedCols = (prev.seatColumns || []).filter(c => c.id !== colId)
      const { seats, rowLabels } = deriveGridSeats(updatedCols)
      return {
        ...prev,
        seatColumns: updatedCols,
        seats,
        rowLabels,
        gridSize: {
          rows: maxRowFromSeats(seats),
          cols: maxColFromSeats(seats),
        },
      }
    })
    if (selectedColumnId === colId) {
      const remaining = seatColumns.filter(c => c.id !== colId)
      setSelectedColumnId(remaining.length > 0 ? remaining[0].id : null)
    }
  }, [selectedColumnId, seatColumns, updateLayout])

  // Paint a seat onto the canvas
  const handlePaintSeat = useCallback((colId: string, x: number, y: number) => {
    updateLayout(prev => {
      if (prev.type !== 'NUMBERED') return prev
      const cols = prev.seatColumns || []
      const colIdx = cols.findIndex(c => c.id === colId)
      if (colIdx === -1) return prev
      const col = cols[colIdx]
      if (col.seats.length >= MAX_SEATS_PER_COLUMN) return prev

      let snapX = magneticMode ? Math.round(x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE : Math.round(x)
      let snapY = magneticMode ? Math.round(y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE : Math.round(y)

      // Clamp to canvas bounds
      snapX = Math.max(PAINTED_SEAT_SIZE / 2, Math.min(snapX, (prev.canvasWidth || DEFAULT_CANVAS_W) - PAINTED_SEAT_SIZE / 2))
      snapY = Math.max(PAINTED_SEAT_SIZE / 2, Math.min(snapY, (prev.canvasHeight || DEFAULT_CANVAS_H) - PAINTED_SEAT_SIZE / 2))

      // COLLISION DETECTION: Check overlap with ALL existing seats across ALL columns
      const hasCollision = cols.some(c =>
        c.seats.some(s =>
          Math.abs(s.x - snapX) < PAINTED_SEAT_SIZE &&
          Math.abs(s.y - snapY) < PAINTED_SEAT_SIZE
        )
      )
      if (hasCollision) return prev

      // Check for duplicate position in this column
      const posKey = `${snapX},${snapY}`
      const exists = col.seats.some(s => `${s.x},${s.y}` === posKey)
      if (exists) return prev

      const newSeat: PaintedSeat = {
        id: generateId(),
        x: snapX, y: snapY,
        seatNum: col.seats.length + 1,
      }
      const updatedCols = cols.map((c, i) =>
        i === colIdx ? { ...c, seats: [...c.seats, newSeat] } : c
      )
      const { seats, rowLabels } = deriveGridSeats(updatedCols)
      return {
        ...prev,
        seatColumns: updatedCols,
        seats,
        rowLabels,
        gridSize: {
          rows: maxRowFromSeats(seats),
          cols: maxColFromSeats(seats),
        },
      }
    })
    return magneticMode
      ? `${Math.round(x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE},${Math.round(y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE}`
      : null
  }, [updateLayout, magneticMode])

  // Remove a seat
  const handleRemoveSeat = useCallback((colId: string, seatId: string) => {
    updateLayout(prev => {
      if (prev.type !== 'NUMBERED') return prev
      const cols = prev.seatColumns || []
      const updatedCols = cols.map(c => {
        if (c.id !== colId) return c
        const filteredSeats = c.seats.filter(s => s.id !== seatId)
        // Renumber remaining seats
        return { ...c, seats: filteredSeats.map((s, idx) => ({ ...s, seatNum: idx + 1 })) }
      })
      const { seats, rowLabels } = deriveGridSeats(updatedCols)
      return {
        ...prev,
        seatColumns: updatedCols,
        seats,
        rowLabels,
        gridSize: {
          rows: maxRowFromSeats(seats),
          cols: maxColFromSeats(seats),
        },
      }
    })
  }, [updateLayout])

  // Canvas click handler for painting
  const handlePaintCanvasClick = useCallback((e: React.MouseEvent) => {
    if (isPreview || !selectedColumnId || layoutData.type !== 'NUMBERED') return
    if (elementsLocked) return

    const canvas = paintCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if clicking on stage or object area - don't paint there
    if (selectedElementType) return

    const col = seatColumns.find(c => c.id === selectedColumnId)
    if (!col) return

    if (col.seats.length >= MAX_SEATS_PER_COLUMN) {
      toast({
        title: 'Batas Kursi',
        description: `Kolom ${col.label} sudah mencapai maksimal ${MAX_SEATS_PER_COLUMN} kursi.`,
        variant: 'destructive',
      })
      return
    }

    handlePaintSeat(selectedColumnId, x, y)
  }, [isPreview, selectedColumnId, layoutData.type, seatColumns, elementsLocked, selectedElementType, handlePaintSeat, toast])

  // Canvas mouse down for drag-painting
  const handlePaintCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || isPreview || !selectedColumnId || layoutData.type !== 'NUMBERED') return
    if (elementsLocked || selectedElementType) return

    const canvas = paintCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    isPaintDraggingRef.current = true

    const col = seatColumns.find(c => c.id === selectedColumnId)
    if (!col || col.seats.length >= MAX_SEATS_PER_COLUMN) return

    const snapX = magneticMode ? Math.round(x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE : x
    const snapY = magneticMode ? Math.round(y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE : y
    lastPaintedPosRef.current = `${snapX},${snapY}`
    handlePaintSeat(selectedColumnId, x, y)
  }, [isPreview, selectedColumnId, layoutData.type, seatColumns, elementsLocked, selectedElementType, magneticMode, handlePaintSeat])

  const handlePaintCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPaintDraggingRef.current || !selectedColumnId) return
    if (layoutData.type !== 'NUMBERED') return

    const canvas = paintCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const snapX = magneticMode ? Math.round(x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE : x
    const snapY = magneticMode ? Math.round(y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE : y
    const posKey = `${snapX},${snapY}`

    if (posKey === lastPaintedPosRef.current) return

    const col = seatColumns.find(c => c.id === selectedColumnId)
    if (!col || col.seats.length >= MAX_SEATS_PER_COLUMN) return

    lastPaintedPosRef.current = posKey
    handlePaintSeat(selectedColumnId, x, y)
  }, [selectedColumnId, layoutData.type, seatColumns, magneticMode, handlePaintSeat])

  const handlePaintCanvasMouseUp = useCallback(() => {
    isPaintDraggingRef.current = false
    lastPaintedPosRef.current = null
  }, [])

  const handlePaintCanvasMouseLeave = useCallback(() => {
    isPaintDraggingRef.current = false
    lastPaintedPosRef.current = null
  }, [])

  // Canvas context menu (right-click to erase)
  const handlePaintCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  // Canvas resize
  const handleCanvasResize = useCallback((dimension: 'width' | 'height', value: number) => {
    const clamped = Math.max(MIN_CANVAS, Math.min(MAX_CANVAS, value))
    updateLayout(prev => {
      if (prev.type !== 'NUMBERED') return prev
      return {
        ...prev,
        [dimension === 'width' ? 'canvasWidth' : 'canvasHeight']: clamped,
      }
    })
  }, [updateLayout])

  // ─── Section CRUD ──────────────────────
  const getSortedColumnCount = useCallback(() => {
    return seatColumns.length
  }, [seatColumns])

  const openNewSectionDialog = useCallback(() => {
    setEditingSection(null)
    const maxRow = Math.max(0, seatColumns.length - 1)
    setSectionForm({ name: '', fromRow: 0, toRow: Math.min(2, maxRow), colorCode: DEFAULT_COLORS[0] })
    setSectionDialogOpen(true)
  }, [seatColumns.length])

  const openEditSectionDialog = useCallback((section: Section, index: number) => {
    setEditingSection({ ...section, _index: index } as any)
    setSectionForm({ name: section.name, fromRow: section.fromRow, toRow: section.toRow, colorCode: section.colorCode })
    setSectionDialogOpen(true)
  }, [])

  const handleSaveSection = useCallback(() => {
    if (!sectionForm.name.trim()) return
    updateLayout(prev => {
      if (prev.type !== 'NUMBERED') return prev
      const newSection: Section = {
        name: sectionForm.name.trim(),
        fromRow: sectionForm.fromRow,
        toRow: sectionForm.toRow,
        colorCode: sectionForm.colorCode,
      }
      if (editingSection && (editingSection as any)._index !== undefined) {
        const idx = (editingSection as any)._index
        const newSections = [...prev.sections]
        newSections[idx] = newSection
        return { ...prev, sections: newSections }
      }
      return { ...prev, sections: [...prev.sections, newSection] }
    })
    setSectionDialogOpen(false)
  }, [sectionForm, editingSection, updateLayout])

  const handleDeleteSection = useCallback((index: number) => {
    updateLayout(prev => {
      if (prev.type !== 'NUMBERED') return prev
      return { ...prev, sections: prev.sections.filter((_, i) => i !== index) }
    })
  }, [updateLayout])

  // ═════════════════════════════════════════
  // GENERAL_ADMISSION Mode Handlers
  // ═════════════════════════════════════════

  const getCellFromEvent = useCallback(
    (e: React.MouseEvent): { r: number; c: number } | null => {
      const container = gridContainerRef.current
      if (!container) return null
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const c = Math.floor(x / CELL_SIZE)
      const r = Math.floor(y / CELL_SIZE)
      if (r < 0 || r >= gridSize.rows || c < 0 || c >= gridSize.cols) return null
      return { r, c }
    },
    [gridSize]
  )

  const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (isPreview || layoutData.type !== 'GENERAL_ADMISSION') return
    const cell = getCellFromEvent(e)
    if (!cell) return

    if (selectedZoneId) {
      const zone = layoutData.zones.find((z: Zone) => z.id === selectedZoneId)
      if (zone) {
        const handle = getZoneResizeHandle(e, zone)
        if (handle) {
          setIsResizingZone(true); isResizingZoneRef.current = true
          setZoneResizeHandle(handle); zoneResizeHandleRef.current = handle
          setZoneDragStart({ x: e.clientX, y: e.clientY }); zoneDragStartRef.current = { x: e.clientX, y: e.clientY }
          return
        }
      }
    }
    const clickedZone = layoutData.zones.find((z: Zone) => cell.r >= z.r && cell.r < z.r + z.h && cell.c >= z.c && cell.c < z.c + z.w)
    if (clickedZone) {
      setSelectedZoneId(clickedZone.id); selectedZoneIdRef.current = clickedZone.id
      setIsDraggingZone(true); isDraggingZoneRef.current = true
      setZoneDragStart({ x: e.clientX, y: e.clientY }); zoneDragStartRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    setSelectedZoneId(null); selectedZoneIdRef.current = null
    setIsCreatingZone(true); isCreatingZoneRef.current = true
    setZoneCreateStart(cell); zoneCreateStartRef.current = cell
  }, [isPreview, layoutData, selectedZoneId, getCellFromEvent])

  const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (layoutData.type !== 'GENERAL_ADMISSION') return
    const cell = getCellFromEvent(e)
    if (cell) currentCellRef.current = cell
    const _isDraggingZone = isDraggingZoneRef.current
    const _selectedZoneId = selectedZoneIdRef.current
    const _zoneDragStart = zoneDragStartRef.current
    const _isResizingZone = isResizingZoneRef.current
    const _zoneResizeHandle = zoneResizeHandleRef.current

    if (_isDraggingZone && _selectedZoneId && _zoneDragStart) {
      const dx = Math.round((e.clientX - _zoneDragStart.x) / CELL_SIZE)
      const dy = Math.round((e.clientY - _zoneDragStart.y) / CELL_SIZE)
      updateLayout(prev => {
        if (prev.type !== 'GENERAL_ADMISSION') return prev
        return { ...prev, zones: prev.zones.map(z => z.id === _selectedZoneId ? { ...z, r: Math.max(0, Math.min(gridSize.rows - z.h, z.r + dy)), c: Math.max(0, Math.min(gridSize.cols - z.w, z.c + dx)) } : z) }
      })
      setZoneDragStart({ x: e.clientX, y: e.clientY }); zoneDragStartRef.current = { x: e.clientX, y: e.clientY }
    }
    if (_isResizingZone && _selectedZoneId && _zoneDragStart && _zoneResizeHandle) {
      const dx = Math.round((e.clientX - _zoneDragStart.x) / CELL_SIZE)
      const dy = Math.round((e.clientY - _zoneDragStart.y) / CELL_SIZE)
      updateLayout(prev => {
        if (prev.type !== 'GENERAL_ADMISSION') return prev
        return { ...prev, zones: prev.zones.map(z => {
          if (z.id !== _selectedZoneId) return z
          let { r, c, w, h } = z
          if (_zoneResizeHandle.includes('e')) w = Math.max(1, Math.min(gridSize.cols - c, w + dx))
          if (_zoneResizeHandle.includes('w')) { const nc = Math.max(0, Math.min(c + dx, c + w - 1)); w = w + (c - nc); c = nc }
          if (_zoneResizeHandle.includes('s')) h = Math.max(1, Math.min(gridSize.rows - r, h + dy))
          if (_zoneResizeHandle.includes('n')) { const nr = Math.max(0, Math.min(r + dy, r + h - 1)); h = h + (r - nr); r = nr }
          return { ...z, r, c, w, h }
        }) }
      })
      setZoneDragStart({ x: e.clientX, y: e.clientY }); zoneDragStartRef.current = { x: e.clientX, y: e.clientY }
    }
  }, [layoutData.type, gridSize, updateLayout, getCellFromEvent])

  const createZoneFromDrag = useCallback((endCell: { r: number; c: number }) => {
    const start = zoneCreateStartRef.current
    if (!start) return
    const r = Math.min(start.r, endCell.r); const c = Math.min(start.c, endCell.c)
    const w = Math.abs(endCell.c - start.c) + 1; const h = Math.abs(endCell.r - start.r) + 1
    if (w < 1 || h < 1) return
    const newZone: Zone = {
      id: generateId(), name: 'Zone Baru', r, c, w, h,
      capacity: w * h,
      colorCode: DEFAULT_COLORS[(layoutData.type === 'GENERAL_ADMISSION' ? layoutData.zones : []).length % DEFAULT_COLORS.length],
    }
    updateLayout(prev => {
      if (prev.type !== 'GENERAL_ADMISSION') return prev
      return { ...prev, zones: [...prev.zones, newZone] }
    })
    setSelectedZoneId(newZone.id); selectedZoneIdRef.current = newZone.id
    setIsCreatingZone(false); isCreatingZoneRef.current = false
    setZoneCreateStart(null); zoneCreateStartRef.current = null
  }, [layoutData, updateLayout])

  const handleGridMouseUp = useCallback((e: React.MouseEvent) => {
    if (isCreatingZoneRef.current && zoneCreateStartRef.current) {
      const cell = getCellFromEvent(e)
      if (cell) createZoneFromDrag(cell)
      else if (currentCellRef.current) createZoneFromDrag(currentCellRef.current)
    }
    setIsDraggingZone(false); isDraggingZoneRef.current = false
    setIsResizingZone(false); isResizingZoneRef.current = false
    setIsCreatingZone(false); isCreatingZoneRef.current = false
    setZoneDragStart(null); zoneDragStartRef.current = null
    setZoneCreateStart(null); zoneCreateStartRef.current = null
    setZoneResizeHandle(null); zoneResizeHandleRef.current = null
    currentCellRef.current = null
  }, [getCellFromEvent, createZoneFromDrag])

  const handleGridMouseLeave = useCallback(() => {
    setIsDraggingZone(false); isDraggingZoneRef.current = false
    setIsResizingZone(false); isResizingZoneRef.current = false
    setIsCreatingZone(false); isCreatingZoneRef.current = false
    setZoneDragStart(null); zoneDragStartRef.current = null
    setZoneCreateStart(null); zoneCreateStartRef.current = null
    setZoneResizeHandle(null); zoneResizeHandleRef.current = null
    currentCellRef.current = null
    isPaintDraggingRef.current = false
    lastPaintedPosRef.current = null
  }, [])

  const handleGACellClick = useCallback((r: number, c: number) => {
    if (isPreview || layoutData.type !== 'GENERAL_ADMISSION') return
    if (isCreatingZone && zoneCreateStart) { createZoneFromDrag({ r, c }); return }
    const clickedZone = layoutData.zones.find((z: Zone) => r >= z.r && r < z.r + z.h && c >= z.c && c < z.c + z.w)
    setSelectedZoneId(clickedZone ? clickedZone.id : null)
  }, [isPreview, layoutData, isCreatingZone, zoneCreateStart, createZoneFromDrag])

  const updateZoneProperty = useCallback((zoneId: string, updates: Partial<Zone>) => {
    updateLayout(prev => {
      if (prev.type !== 'GENERAL_ADMISSION') return prev
      return { ...prev, zones: prev.zones.map(z => z.id === zoneId ? { ...z, ...updates } : z) }
    })
  }, [updateLayout])

  const deleteZone = useCallback((zoneId: string) => {
    updateLayout(prev => {
      if (prev.type !== 'GENERAL_ADMISSION') return prev
      return { ...prev, zones: prev.zones.filter(z => z.id !== zoneId) }
    })
    if (selectedZoneId === zoneId) setSelectedZoneId(null)
  }, [updateLayout, selectedZoneId])

  const getZoneResizeHandle = useCallback((e: React.MouseEvent, zone: Zone): string | null => {
    const container = gridContainerRef.current
    if (!container) return null
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left; const y = e.clientY - rect.top
    const left = zone.c * CELL_SIZE; const top = zone.r * CELL_SIZE
    const right = (zone.c + zone.w) * CELL_SIZE; const bottom = (zone.r + zone.h) * CELL_SIZE
    const handleSize = 8
    const nearL = Math.abs(x - left) < handleSize; const nearR = Math.abs(x - right) < handleSize
    const nearT = Math.abs(y - top) < handleSize; const nearB = Math.abs(y - bottom) < handleSize
    if (nearT && nearL) return 'nw'; if (nearT && nearR) return 'ne'
    if (nearB && nearL) return 'sw'; if (nearB && nearR) return 'se'
    if (nearT) return 'n'; if (nearB) return 's'; if (nearL) return 'w'; if (nearR) return 'e'
    return null
  }, [])

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isPaintDraggingRef.current = false; lastPaintedPosRef.current = null
      if (isCreatingZoneRef.current) { isCreatingZoneRef.current = false; zoneCreateStartRef.current = null; setIsCreatingZone(false); setZoneCreateStart(null) }
      if (isDraggingZoneRef.current) { isDraggingZoneRef.current = false; zoneDragStartRef.current = null; setIsDraggingZone(false); setZoneDragStart(null) }
      if (isResizingZoneRef.current) { isResizingZoneRef.current = false; zoneDragStartRef.current = null; zoneResizeHandleRef.current = null; setIsResizingZone(false); setZoneDragStart(null); setZoneResizeHandle(null) }
      currentCellRef.current = null
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  // ═════════════════════════════════════════
  // Layout Data getter
  // ═════════════════════════════════════════

  const getExportLayoutData = useCallback(() => {
    const data = deepClone(layoutData)
    const exportData: any = { ...data, objects: deepClone(objects), stageType, stagePosition }
    if (stageType === 'THRUST') {
      exportData.thrustWidth = thrustWidth
      exportData.thrustDepth = thrustDepth
    }
    return exportData
  }, [layoutData, objects, stageType, thrustWidth, thrustDepth, stagePosition])

  // ═════════════════════════════════════════
  // Render helpers
  // ═════════════════════════════════════════

  const renderDraggableStage = () => {
    if (isPreview) {
      return (
        <div className="absolute" style={{ left: stagePosition.x, top: stagePosition.y, width: stagePosition.width, zIndex: 5 }}>
          <StageRenderer stageType={stageType} size="sm" thrustWidth={thrustWidth} thrustDepth={thrustDepth} fillParent />
        </div>
      )
    }
    return (
      <DraggableObject
        id="draggable-stage" x={stagePosition.x} y={stagePosition.y}
        width={stagePosition.width} height={stagePosition.height}
        minWidth={120} minHeight={40}
        isSelected={selectedElementType === 'stage'} isOverlapping={stageIsOverlapping}
        onSelect={handleSelectStage} onPositionChange={setStagePosition}
        label="Stage" disabled={elementsLocked}
      >
        <StageRenderer stageType={stageType} size="sm" thrustWidth={thrustWidth} thrustDepth={thrustDepth} fillParent />
      </DraggableObject>
    )
  }

  const renderDraggableObjects = () => {
    if (isPreview) {
      return objects.map((obj) => (
        <div key={obj.id} className="absolute flex items-center justify-center overflow-hidden pointer-events-none"
          style={{ left: obj.x ?? 0, top: obj.y ?? 0, width: obj.pixelW || obj.w * (CELL_SIZE + 2), height: obj.pixelH || obj.h * (CELL_SIZE + 2), backgroundColor: obj.color + '25', border: `2px dashed ${obj.color}80`, borderRadius: 4, zIndex: 5 }}>
          <div className="text-center px-1">
            <span className="text-[8px] sm:text-[9px] font-bold leading-tight block truncate max-w-full" style={{ color: obj.color }}>
              {obj.type === 'ENTRANCE' ? '🚪 ' : ''}{obj.label || obj.type}
            </span>
          </div>
        </div>
      ))
    }
    const cellPx = CELL_SIZE + 2
    return objects.map((obj) => {
      const isObjSelected = selectedElementType === 'object' && selectedObjectId === obj.id
      const isObjOverlapping = isObjSelected && objectOverlapIds.size > 0
      return (
        <DraggableObject key={obj.id} id={obj.id}
          x={obj.x ?? obj.c * cellPx} y={obj.y ?? obj.r * cellPx}
          width={obj.pixelW ?? obj.w * cellPx} height={obj.pixelH ?? obj.h * cellPx}
          minWidth={30} minHeight={30}
          isSelected={isObjSelected} isOverlapping={isObjOverlapping}
          onSelect={() => handleSelectObject(obj.id)}
          onPositionChange={(pos) => updateObject(obj.id, { x: pos.x, y: pos.y, pixelW: pos.width, pixelH: pos.height })}
          label={obj.label || obj.type} disabled={elementsLocked}
        >
          <div className="w-full h-full flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: obj.color + '25', border: `2px dashed ${obj.color}80`, borderRadius: 4 }}>
            <div className="text-center px-1">
              <span className="text-[8px] sm:text-[9px] font-bold leading-tight block truncate max-w-full" style={{ color: obj.color }}>
                {obj.type === 'ENTRANCE' ? '🚪 ' : ''}{obj.label || obj.type}
              </span>
            </div>
          </div>
        </DraggableObject>
      )
    })
  }

  // ─── PAINT CANVAS (NUMBERED mode) ─────
  const renderPaintCanvas = () => {
    try {
      if (safeLayoutData.type !== 'NUMBERED') return null

      const sorted = sortColumnsByAvgY(seatColumns)
      // Build a lookup for section color by sorted column index
      const colSectionColors = new Map<string, string>()
      sorted.forEach((col, idx) => {
        const secColor = sectionColorMap.get(idx)
        if (secColor) colSectionColors.set(col.id, secColor)
      })

      return (
        <div
          ref={paintCanvasRef}
          className="relative select-none cursor-crosshair rounded-lg border border-border/30"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            minWidth: canvasWidth,
            minHeight: canvasHeight,
            backgroundColor: '#faf9f6',
          }}
          onClick={handlePaintCanvasClick}
          onMouseDown={handlePaintCanvasMouseDown}
          onMouseMove={handlePaintCanvasMouseMove}
          onMouseUp={handlePaintCanvasMouseUp}
          onMouseLeave={handlePaintCanvasMouseLeave}
          onContextMenu={handlePaintCanvasContextMenu}
        >
          {/* Snap grid background */}
          {magneticMode && !isPreview && (
            <div
              className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none"
              style={{
                backgroundImage: `
                  radial-gradient(circle, rgba(200,169,81,0.15) 1px, transparent 1px)
                `,
                backgroundSize: `${SNAP_GRID_SIZE}px ${SNAP_GRID_SIZE}px`,
                backgroundPosition: `${SNAP_GRID_SIZE / 2}px ${SNAP_GRID_SIZE / 2}px`,
              }}
            />
          )}

          {/* Draggable stage */}
          {renderDraggableStage()}

          {/* Painted seats */}
          {seatColumns.map(col => {
            const isSelected = col.id === selectedColumnId
            const secColor = colSectionColors.get(col.id)
            const bgColor = secColor || col.color

            return col.seats.map(seat => (
              <div
                key={seat.id}
                className={cn(
                  'absolute flex items-center justify-center rounded-[4px] border-2 transition-all duration-100 select-none',
                  isSelected && !isPreview && 'ring-2 ring-offset-1 ring-gold/40',
                  isPreview && 'pointer-events-none',
                  !isPreview && 'hover:scale-105',
                )}
                style={{
                  left: seat.x - PAINTED_SEAT_SIZE / 2,
                  top: seat.y - PAINTED_SEAT_SIZE / 2,
                  width: PAINTED_SEAT_SIZE,
                  height: PAINTED_SEAT_SIZE,
                  backgroundColor: bgColor,
                  borderColor: bgColor,
                  zIndex: 2,
                  cursor: isPreview ? 'default' : 'pointer',
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!isPreview && !elementsLocked) handleRemoveSeat(col.id, seat.id)
                }}
                onClick={(e) => {
                  if (isPreview || elementsLocked) return
                  // If clicking a seat in non-selected column, switch to that column
                  if (col.id !== selectedColumnId) {
                    setSelectedColumnId(col.id)
                  }
                }}
                title={`${col.label}-${seat.seatNum} (klik kanan untuk hapus)`}
              >
                <span className="text-[7px] font-bold leading-none" style={{ color: '#ffffff' }}>
                  {col.label}{seat.seatNum}
                </span>
              </div>
            ))
          })}

          {/* Column labels on the left edge */}
          {sorted.map((col, idx) => {
            if (col.seats.length === 0) return null
            const avgY = col.seats.reduce((s, seat) => s + seat.y, 0) / col.seats.length
            const secColor = colSectionColors.get(col.id)
            return (
              <div
                key={`label-${col.id}`}
                className="absolute flex items-center justify-center pointer-events-none"
                style={{
                  left: -24,
                  top: avgY - PAINTED_SEAT_SIZE / 2,
                  width: 20,
                  height: PAINTED_SEAT_SIZE,
                  zIndex: 1,
                }}
              >
                <span className="text-[10px] font-serif font-semibold text-muted-foreground">
                  {col.label}
                </span>
              </div>
            )
          })}

          {/* Draggable objects */}
          {renderDraggableObjects()}

          {/* No columns placeholder */}
          {seatColumns.length === 0 && !isPreview && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Paintbrush className="w-8 h-8 text-muted-foreground/20 mb-2" />
              <p className="text-xs text-muted-foreground/40 text-center px-4">
                Tambahkan kolom di panel kiri, lalu klik pada kanvas untuk menempatkan kursi.
              </p>
            </div>
          )}

          {/* Selected column indicator */}
          {selectedColumn && !isPreview && (
            <div className="absolute top-2 left-2 pointer-events-none z-10">
              <Badge className="bg-gold/90 text-charcoal text-[10px] shadow-sm">
                <Paintbrush className="w-3 h-3 mr-1" />
                Melukis: {selectedColumn.label}
              </Badge>
            </div>
          )}

          {/* Magnetic mode indicator */}
          {magneticMode && !isPreview && (
            <div className="absolute top-2 right-2 pointer-events-none z-10">
              <Badge className="bg-blue-500/80 text-white text-[10px] shadow-sm">
                <Magnet className="w-3 h-3 mr-1" />
                Magnetik ON
              </Badge>
            </div>
          )}
        </div>
      )
    } catch (err) {
      console.error('[CanvasEditor] renderPaintCanvas error:', err)
      setRenderError(`renderPaintCanvas: ${err instanceof Error ? err.message : String(err)}`)
      return <div className="text-center text-red-500 py-8">Error rendering canvas: {err instanceof Error ? err.message : String(err)}</div>
    }
  }

  // ─── GA Grid Render ────────────────────
  const renderGAGrid = () => {
    try {
      if (safeLayoutData.type !== 'GENERAL_ADMISSION') return null
      const { rows, cols } = gridSize
      const gaZones = Array.isArray((safeLayoutData as GALayout).zones) ? (safeLayoutData as GALayout).zones : []

      return (
        <div ref={gridContainerRef}
          className="relative select-none rounded-lg border-2 border-dashed border-gold/20 bg-gold/[0.02] cursor-crosshair"
          style={{ width: cols * CELL_SIZE, height: rows * CELL_SIZE, minWidth: cols * CELL_SIZE, minHeight: rows * CELL_SIZE }}
          onMouseDown={handleGridMouseDown} onMouseMove={handleGridMouseMove} onMouseUp={handleGridMouseUp} onMouseLeave={handleGridMouseLeave}
        >
          <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none"
            style={{ backgroundImage: `linear-gradient(to right, rgba(200,169,81,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(200,169,81,0.08) 1px, transparent 1px)`, backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px` }}
          />
          {gaZones.map(zone => {
            const isSelected = zone.id === selectedZoneId
            return (
              <div key={zone.id}
                className={cn('absolute rounded-md border-2 flex flex-col items-center justify-center gap-1 transition-shadow duration-150', isSelected ? 'shadow-lg ring-2 ring-gold/30' : 'shadow-sm hover:shadow-md', isPreview && 'pointer-events-none')}
                style={{ left: zone.c * CELL_SIZE, top: zone.r * CELL_SIZE, width: zone.w * CELL_SIZE, height: zone.h * CELL_SIZE, backgroundColor: zone.colorCode + '25', borderColor: isSelected ? zone.colorCode : zone.colorCode + '80', cursor: isPreview ? 'default' : isDraggingZone && isSelected ? 'grabbing' : 'grab' }}
                onClick={e => { e.stopPropagation(); if (!isPreview) setSelectedZoneId(zone.id) }}
              >
                <span className="text-[9px] font-bold leading-tight text-center px-1 truncate w-full" style={{ color: zone.colorCode }}>{zone.name}</span>
                <span className="text-[8px] text-muted-foreground">{zone.capacity} kursi</span>
                {isSelected && !isPreview && (
                  <>
                    {(['nw', 'ne', 'sw', 'se'] as const).map(pos => (
                      <div key={pos}
                        className={cn('absolute w-2 h-2 rounded-full border-2 bg-white',
                          pos === 'nw' && 'top-[-4px] left-[-4px] cursor-nw-resize',
                          pos === 'ne' && 'top-[-4px] right-[-4px] cursor-ne-resize',
                          pos === 'sw' && 'bottom-[-4px] left-[-4px] cursor-sw-resize',
                          pos === 'se' && 'bottom-[-4px] right-[-4px] cursor-se-resize')}
                        style={{ borderColor: zone.colorCode }}
                        onMouseDown={e => { e.stopPropagation(); setIsResizingZone(true); setZoneResizeHandle(pos); setZoneDragStart({ x: e.clientX, y: e.clientY }) }}
                      />
                    ))}
                    {(['n', 's', 'e', 'w'] as const).map(pos => (
                      <div key={pos}
                        className={cn('absolute bg-white border-2',
                          pos === 'n' && 'top-[-3px] left-1/2 -translate-x-1/2 w-6 h-1.5 cursor-n-resize rounded-sm',
                          pos === 's' && 'bottom-[-3px] left-1/2 -translate-x-1/2 w-6 h-1.5 cursor-s-resize rounded-sm',
                          pos === 'e' && 'right-[-3px] top-1/2 -translate-y-1/2 h-6 w-1.5 cursor-e-resize rounded-sm',
                          pos === 'w' && 'left-[-3px] top-1/2 -translate-y-1/2 h-6 w-1.5 cursor-w-resize rounded-sm')}
                        style={{ borderColor: zone.colorCode }}
                        onMouseDown={e => { e.stopPropagation(); setIsResizingZone(true); setZoneResizeHandle(pos); setZoneDragStart({ x: e.clientX, y: e.clientY }) }}
                      />
                    ))}
                  </>
                )}
              </div>
            )
          })}
          {isCreatingZone && zoneCreateStart && currentCellRef.current && (
            <div className="absolute border-2 border-dashed border-gold/60 rounded-md bg-gold/10 pointer-events-none"
              style={{ left: Math.min(zoneCreateStart.c, currentCellRef.current.c) * CELL_SIZE, top: Math.min(zoneCreateStart.r, currentCellRef.current.r) * CELL_SIZE, width: (Math.abs(currentCellRef.current.c - zoneCreateStart.c) + 1) * CELL_SIZE, height: (Math.abs(currentCellRef.current.r - zoneCreateStart.r) + 1) * CELL_SIZE }}
            />
          )}
          {renderDraggableObjects()}
        </div>
      )
    } catch (err) {
      console.error('[CanvasEditor] renderGAGrid error:', err)
      setRenderError(`renderGAGrid: ${err instanceof Error ? err.message : String(err)}`)
      return <div className="text-center text-red-500 py-8">Error: {err instanceof Error ? err.message : String(err)}</div>
    }
  }

  // ═════════════════════════════════════════
  // Main Render
  // ═════════════════════════════════════════

  console.log('[CanvasEditor] Render - type:', safeLayoutData?.type)

  if (renderError) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="max-w-lg p-6 bg-red-50 border border-red-200 rounded-xl text-center">
          <p className="font-semibold text-red-800 mb-2">Render Error</p>
          <pre className="text-xs text-left bg-white p-4 rounded-lg overflow-auto max-h-60 border border-red-100">{renderError}</pre>
          <button className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded-lg text-sm" onClick={() => setRenderError(null)}>Coba Lagi</button>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <SectionBoundary name="MainLayout">
      <div className="flex flex-col lg:flex-row h-full min-h-[600px] bg-warm-white rounded-xl border border-border/50 shadow-sm overflow-hidden">
        {/* ═══════ SIDEBAR ═══════ */}
        <div className="w-full lg:w-72 xl:w-80 bg-charcoal text-warm-white flex-shrink-0 flex flex-col">
          {/* Sidebar Header */}
          <div className="px-4 py-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-base font-semibold text-gold flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {isNumbered ? 'Seat Editor' : 'Zone Editor'}
              </h2>
              <Badge variant="outline" className="text-[10px] border-gold/30 text-gold bg-gold/10">
                {seatType === 'NUMBERED' ? 'Numbered' : 'General Admission'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-warm-white/50">
              <Lock className="w-3 h-3" />
              <span>Dikunci oleh {adminName}</span>
            </div>
            {autoSaveTime && (
              <div className="flex items-center gap-1.5 text-[10px] text-gold/60 mt-1">
                <Clock className="w-3 h-3" />
                <span>Autosave {formatTime(autoSaveTime)}</span>
                {isAutoSaving && <span className="inline-block w-2 h-2 rounded-full bg-gold animate-pulse" />}
              </div>
            )}
          </div>

          {/* Sidebar Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Undo/Redo/Preview */}
            <div className="flex items-center gap-2">
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo} className="h-8 w-8 p-0 text-warm-white/70 hover:text-gold hover:bg-white/10"><Undo2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent side="right">Undo (Ctrl+Z)</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo} className="h-8 w-8 p-0 text-warm-white/70 hover:text-gold hover:bg-white/10"><Redo2 className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent side="right">Redo (Ctrl+Y)</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => setIsPreview(!isPreview)} className={cn('h-8 w-8 p-0', isPreview ? 'text-gold bg-gold/15' : 'text-warm-white/70 hover:text-gold hover:bg-white/10')}>{isPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button></TooltipTrigger><TooltipContent side="right">{isPreview ? 'Exit Preview' : 'Preview Mode'}</TooltipContent></Tooltip>
            </div>

            <Separator className="bg-white/10" />

            {/* Lock Elements */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => setElementsLocked(prev => !prev)}
                  className={cn('h-8 w-8 p-0', elementsLocked ? 'text-amber-400 bg-amber-400/15' : 'text-warm-white/70 hover:text-gold hover:bg-white/10')}>
                  {elementsLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{elementsLocked ? 'Unlock Elements' : 'Lock Elements'}</TooltipContent>
            </Tooltip>

            {/* Neutral Cursor / Deselect — return to paint mode */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleDeselectAll}
                  className={cn('h-8 w-8 p-0', !selectedElementType ? 'text-gold bg-gold/15' : 'text-warm-white/70 hover:text-gold hover:bg-white/10')}>
                  <MousePointer2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{!selectedElementType ? 'Kursor Netral (Paint Mode)' : 'Klik untuk Deselect'}</TooltipContent>
            </Tooltip>
            {elementsLocked && (
              <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-2">
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium"><Lock className="w-3 h-3" />Terkunci</div>
                <p className="text-[9px] text-amber-400/60 mt-0.5">Stage & objek tidak bisa digeser</p>
              </div>
            )}

            <Separator className="bg-white/10" />

            {/* Total Seats */}
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-wider text-warm-white/40 mb-1">
                {seatType === 'NUMBERED' ? 'Total Kursi' : 'Total Kapasitas'}
              </div>
              <div className="text-2xl font-serif font-bold text-gold">{totalSeats}</div>
              <div className="text-[10px] text-warm-white/40 mt-0.5">
                {isNumbered
                  ? `${seatColumns.length} kolom`
                  : `${((safeLayoutData as GALayout).zones || []).length} zona`}
              </div>
            </div>

            {/* ═══ NUMBERED: Column Controls ═══ */}
            {isNumbered && (
              <>
                {/* Seat Columns */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] uppercase tracking-wider text-warm-white/40 font-medium flex items-center gap-1.5">
                      <Paintbrush className="w-3 h-3" />
                      Kolom Kursi
                    </h3>
                    <Button variant="ghost" size="sm" onClick={handleAddColumn}
                      disabled={seatColumns.length >= 26}
                      className="h-6 px-2 text-[10px] text-gold hover:text-gold hover:bg-gold/15">
                      <Plus className="w-3 h-3 mr-1" />Tambah
                    </Button>
                  </div>

                  {seatColumns.length === 0 ? (
                    <div className="text-center py-4 bg-white/5 rounded-lg">
                      <Paintbrush className="w-6 h-6 text-warm-white/20 mx-auto mb-1" />
                      <p className="text-[10px] text-warm-white/30">Belum ada kolom. Klik &quot;Tambah&quot; untuk memulai.</p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {seatColumns.map(col => (
                        <div key={col.id}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer group',
                            col.id === selectedColumnId
                              ? 'bg-gold/15 border border-gold/30'
                              : 'bg-white/5 hover:bg-white/10 border border-transparent'
                          )}
                          onClick={() => setSelectedColumnId(col.id)}
                        >
                          <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: col.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-warm-white/80">{col.label}</div>
                            <div className="text-[9px] text-warm-white/40">{col.seats.length} kursi</div>
                          </div>
                          {col.id === selectedColumnId && (
                            <Badge className="text-[8px] h-4 px-1.5 bg-gold/20 text-gold border-gold/30 border">Aktif</Badge>
                          )}
                          <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleDeleteColumn(col.id) }}
                            className="h-5 w-5 p-0 text-warm-white/40 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {seatColumns.length >= 26 && (
                    <p className="text-[9px] text-amber-400/60">Maksimal 26 kolom (A–Z) tercapai.</p>
                  )}
                </div>

                <Separator className="bg-white/10" />

                {/* Magnetic Snap */}
                <div className="space-y-2">
                  <h3 className="text-[11px] uppercase tracking-wider text-warm-white/40 font-medium flex items-center gap-1.5">
                    <Magnet className="w-3 h-3" />
                    Snap Magnetik
                  </h3>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => setMagneticMode(!magneticMode)}
                    className={cn(
                      'w-full justify-start gap-2 text-xs h-8',
                      magneticMode
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20'
                        : 'text-warm-white/60 hover:text-gold hover:bg-white/10'
                    )}
                  >
                    <Magnet className="w-3.5 h-3.5" />
                    {magneticMode ? 'Magnetik AKTIF' : 'Magnetik NONAKTIF'}
                  </Button>
                  <p className="text-[9px] text-warm-white/30 px-1">
                    {magneticMode
                      ? 'Kursi menempel pada grid 32px. Mudah membuat baris rapi.'
                      : 'Kursi dapat ditempatkan bebas di mana saja.'}
                  </p>
                </div>

                <Separator className="bg-white/10" />

                {/* Canvas Size */}
                <div className="space-y-3">
                  <h3 className="text-[11px] uppercase tracking-wider text-warm-white/40 font-medium">
                    Ukuran Kanvas
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-warm-white/50 block mb-0.5">Lebar (px)</label>
                      <Input type="number" value={canvasWidth} min={MIN_CANVAS} max={MAX_CANVAS}
                        onChange={e => handleCanvasResize('width', parseInt(e.target.value) || DEFAULT_CANVAS_W)}
                        className="h-7 text-[11px] bg-white/10 border-white/10 text-warm-white" />
                    </div>
                    <div>
                      <label className="text-[10px] text-warm-white/50 block mb-0.5">Tinggi (px)</label>
                      <Input type="number" value={canvasHeight} min={MIN_CANVAS} max={MAX_CANVAS}
                        onChange={e => handleCanvasResize('height', parseInt(e.target.value) || DEFAULT_CANVAS_H)}
                        className="h-7 text-[11px] bg-white/10 border-white/10 text-warm-white" />
                    </div>
                  </div>
                </div>

                <Separator className="bg-white/10" />

                {/* Sections */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] uppercase tracking-wider text-warm-white/40 font-medium">Seksion</h3>
                    <Button variant="ghost" size="sm" onClick={openNewSectionDialog}
                      className="h-6 w-6 p-0 text-warm-white/60 hover:text-gold hover:bg-white/10">
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {(Array.isArray(safeLayoutData.sections) && safeLayoutData.sections.length === 0) ? (
                    <p className="text-[10px] text-warm-white/30 px-1">Belum ada seksion. Tambahkan untuk mengelompokkan kolom.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {(safeLayoutData.sections || []).map((sec, idx) => {
                        const sorted = sortColumnsByAvgY(seatColumns)
                        const fromLabel = sorted[sec.fromRow]?.label || `${sec.fromRow + 1}`
                        const toLabel = sorted[sec.toRow]?.label || `${sec.toRow + 1}`
                        return (
                          <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group">
                            <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: sec.colorCode }} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-warm-white/80 truncate">{sec.name}</div>
                              <div className="text-[9px] text-warm-white/40">Kolom {fromLabel}–{toLabel}</div>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="sm" onClick={() => openEditSectionDialog(sec, idx)} className="h-5 w-5 p-0 text-warm-white/40 hover:text-gold"><Edit3 className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteSection(idx)} className="h-5 w-5 p-0 text-warm-white/40 hover:text-danger"><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══ GA: Zones ═══ */}
            {!isNumbered && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] uppercase tracking-wider text-warm-white/40 font-medium">Zona</h3>
                  <span className="text-[10px] text-gold/60">Klik & drag untuk buat zona baru</span>
                </div>
                {(Array.isArray((safeLayoutData as GALayout).zones) && (safeLayoutData as GALayout).zones.length === 0) ? (
                  <div className="text-center py-6 bg-white/5 rounded-lg">
                    <Square className="w-8 h-8 text-warm-white/20 mx-auto mb-2" />
                    <p className="text-[10px] text-warm-white/30">Klik dan drag pada grid untuk membuat zona pertama</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {((safeLayoutData as GALayout).zones || []).map(zone => (
                      <div key={zone.id}
                        className={cn('flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer group',
                          zone.id === selectedZoneId ? 'bg-gold/15 border border-gold/30' : 'bg-white/5 hover:bg-white/10 border border-transparent')}
                        onClick={() => { setSelectedZoneId(zone.id); selectedZoneIdRef.current = zone.id }}
                      >
                        <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: zone.colorCode }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-warm-white/80 truncate">{zone.name}</div>
                          <div className="text-[9px] text-warm-white/40">{zone.w}×{zone.h} · {zone.capacity} kursi</div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); deleteZone(zone.id) }} className="h-5 w-5 p-0 text-warm-white/40 hover:text-danger"><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ Objects Panel ═══ */}
            <>
              <Separator className="bg-white/10" />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] uppercase tracking-wider text-warm-white/40 font-medium flex items-center gap-1.5">
                    <Shapes className="w-3 h-3" />Objek
                  </h3>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => addObject('FOH')} className="h-5 px-1.5 text-[9px] text-warm-white/60 hover:text-gold hover:bg-white/10">FOH</Button>
                    <Button variant="ghost" size="sm" onClick={() => addObject('ENTRANCE')} className="h-5 px-1.5 text-[9px] text-warm-white/60 hover:text-gold hover:bg-white/10">Pintu</Button>
                    <Button variant="ghost" size="sm" onClick={() => addObject('CUSTOM_SHAPE')} className="h-5 px-1.5 text-[9px] text-warm-white/60 hover:text-gold hover:bg-white/10"><Plus className="w-2.5 h-2.5" /></Button>
                  </div>
                </div>
                {objects.length === 0 ? (
                  <p className="text-[10px] text-warm-white/30 px-1">Belum ada objek.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {objects.map(obj => (
                      <div key={obj.id}
                        className={cn('flex items-center gap-2 p-1.5 rounded-lg transition-colors cursor-pointer group',
                          obj.id === selectedObjectId ? 'bg-white/10 border border-white/20' : 'bg-white/5 hover:bg-white/8 border border-transparent')}
                        onClick={() => setSelectedObjectId(obj.id)}
                      >
                        <div className="w-3 h-3 rounded-sm shrink-0 border" style={{ backgroundColor: obj.color + '60', borderColor: obj.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-medium text-warm-white/80 truncate">{obj.type === 'ENTRANCE' ? '🚪 ' : ''}{obj.label}</div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); openEditObjectDialog(obj) }} className="h-4 w-4 p-0 text-warm-white/40 hover:text-gold"><Edit3 className="w-2.5 h-2.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); deleteObject(obj.id) }} className="h-4 w-4 p-0 text-warm-white/40 hover:text-danger"><Trash2 className="w-2.5 h-2.5" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedObject && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                    <div className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: selectedObject.color + '60', border: `1px solid ${selectedObject.color}` }} />
                    <span className="text-[10px] font-medium text-warm-white/80 flex-1 truncate">{selectedObject.type === 'ENTRANCE' ? '🚪 ' : ''}{selectedObject.label}</span>
                    <Button variant="ghost" size="sm" onClick={() => openEditObjectDialog(selectedObject)} className="h-5 w-5 p-0 text-warm-white/60 hover:text-gold"><Edit3 className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteObject(selectedObject.id)} className="h-5 w-5 p-0 text-warm-white/60 hover:text-danger"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <label className="text-[10px] text-warm-white/50 block mb-0.5">Nama</label>
                      <Input value={selectedObject.label} onChange={e => updateObject(selectedObject.id, { label: e.target.value })}
                        className="h-6 text-[10px] bg-white/10 border-white/10 text-warm-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div><label className="text-[10px] text-warm-white/50 block mb-0.5">Warna</label>
                        <Input type="color" value={selectedObject.color} onChange={e => updateObject(selectedObject.id, { color: e.target.value })}
                          className="h-6 w-full p-0.5 bg-white/10 border-white/10 cursor-pointer" /></div>
                    </div>
                  </div>
                </div>
              )}
            </>

            {/* GA Zone Properties */}
            {!isNumbered && selectedZone && (
              <>
                <Separator className="bg-white/10" />
                <div className="space-y-3">
                  <h3 className="text-[11px] uppercase tracking-wider text-warm-white/40 font-medium flex items-center gap-1.5"><Palette className="w-3 h-3" />Properti Zona</h3>
                  <div className="space-y-2">
                    <div><label className="text-[10px] text-warm-white/50 block mb-1">Nama Zona</label>
                      <Input value={selectedZone.name} onChange={e => updateZoneProperty(selectedZone.id, { name: e.target.value })}
                        className="h-7 text-xs bg-white/10 border-white/10 text-warm-white placeholder:text-warm-white/30" placeholder="Nama zona" /></div>
                    <div><label className="text-[10px] text-warm-white/50 block mb-1">Kapasitas</label>
                      <Input type="number" value={selectedZone.capacity} onChange={e => updateZoneProperty(selectedZone.id, { capacity: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="h-7 text-xs bg-white/10 border-white/10 text-warm-white" min={0} /></div>
                    <div><label className="text-[10px] text-warm-white/50 block mb-1">Warna</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DEFAULT_COLORS.map(color => (
                          <button key={color} className={cn('w-6 h-6 rounded-full border-2 transition-transform hover:scale-110', selectedZone.colorCode === color ? 'border-white scale-110' : 'border-transparent')}
                            style={{ backgroundColor: color }} onClick={() => updateZoneProperty(selectedZone.id, { colorCode: color })} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {isPreview && (
              <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gold font-medium"><Eye className="w-3.5 h-3.5" />Preview Mode</div>
                <p className="text-[10px] text-gold/70">Tampilan pengunjung (read-only). Kembali ke mode edit untuk melanjutkan.</p>
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-white/10 space-y-2 bg-charcoal sticky bottom-0 z-10">
            {isAutoSaving && (
              <div className="flex items-center gap-1.5 text-[10px] text-gold/60">
                <span className="inline-block w-2 h-2 rounded-full bg-gold animate-pulse" />Menyimpan...
              </div>
            )}
            <Button onClick={() => { onSaveAndExit(getExportLayoutData(), stageType) }}
              className="w-full bg-gold hover:bg-gold-dark text-charcoal font-medium gap-2 h-9 text-sm">
              <Save className="w-4 h-4" />Simpan & Keluar
            </Button>
          </div>
        </div>

        {/* ═══════ MAIN CANVAS ═══════ */}
        <div className="flex-1 overflow-auto bg-warm-white">
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="font-serif text-lg sm:text-xl font-bold text-charcoal">
                  {isPreview ? 'Preview Seat Map' : 'Seat Map Builder'}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPreview
                    ? 'Tampilan pengunjung (read-only)'
                    : isNumbered
                      ? 'Pilih kolom, lalu klik pada kanvas untuk menempatkan kursi. Klik kanan untuk menghapus.'
                      : 'Klik & drag pada grid untuk membuat zona.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                  <Users className="w-3 h-3 mr-1" />
                  {totalSeats} {seatType === 'NUMBERED' ? 'kursi' : 'kapasitas'}
                </Badge>
                {isPreview && (
                  <Badge className="bg-gold/15 text-gold-dark border-gold/30 text-[10px]">
                    <Eye className="w-3 h-3 mr-1" />Preview
                  </Badge>
                )}
              </div>
            </div>

            <Card className={cn('border-border/40 shadow-sm', isPreview ? 'bg-cream' : 'bg-white')}>
              <div className="p-4 sm:p-6">
                <div
                  className="overflow-auto max-h-[60vh] rounded-lg p-4"
                  style={{
                    backgroundColor: isPreview ? 'transparent' : '#faf9f6',
                    backgroundImage: isPreview ? undefined : 'radial-gradient(circle, rgba(200,169,81,0.03) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                  onClick={e => {
                    if (e.target === e.currentTarget || e.target === e.currentTarget.firstElementChild) handleDeselectAll()
                  }}
                >
                  <div className={cn('inline-block', isNumbered && 'relative')}>
                    {/* Row label gutter for paint mode */}
                    {isNumbered && seatColumns.length > 0 && (
                      <div className="absolute left-0 top-0 w-6 pointer-events-none" style={{ height: canvasHeight }} />
                    )}
                    <div className={cn(isNumbered ? 'pl-7' : 'flex justify-center')}>
                      <SectionBoundary name="GridRender">
                        {isNumbered ? renderPaintCanvas() : renderGAGrid()}
                      </SectionBoundary>
                    </div>
                  </div>
                </div>

                {/* Legend (NUMBERED sections) */}
                {isNumbered && Array.isArray(safeLayoutData.sections) && safeLayoutData.sections.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs">
                    {safeLayoutData.sections.map((sec, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-sm border-2" style={{ backgroundColor: sec.colorCode, borderColor: sec.colorCode }} />
                        <span className="text-muted-foreground">{sec.name}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-sm border-2 border-border/40 bg-white" />
                      <span className="text-muted-foreground">Tanpa Seksion</span>
                    </div>
                  </div>
                )}

                {/* Legend (Preview GA) */}
                {isPreview && !isNumbered && Array.isArray((safeLayoutData as GALayout).zones) && (safeLayoutData as GALayout).zones.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs">
                    {(safeLayoutData as GALayout).zones.map(zone => (
                      <div key={zone.id} className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-sm border-2" style={{ backgroundColor: zone.colorCode + '40', borderColor: zone.colorCode }} />
                        <span className="text-muted-foreground">{zone.name} ({zone.capacity})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Column legend for NUMBERED */}
                {isNumbered && seatColumns.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[10px]">
                    {seatColumns.map(col => (
                      <div key={col.id} className={cn('flex items-center gap-1', col.id === selectedColumnId && 'font-medium')}>
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: col.color }} />
                        <span className="text-muted-foreground">{col.label} ({col.seats.length})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {isPreview && (
              <div className="mt-4 text-center">
                <p className="text-[10px] text-muted-foreground/50">Ini adalah preview. Kembali ke mode edit untuk melanjutkan mengubah seat map.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      </SectionBoundary>

      {/* ═══════ OBJECT EDIT DIALOG ═══════ */}
      <Dialog open={objectDialogOpen} onOpenChange={setObjectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="text-base font-serif">Edit Objek</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nama</Label><Input value={objectForm.label} onChange={e => setObjectForm(p => ({ ...p, label: e.target.value }))} className="h-9 text-sm" /></div>
            <div className="grid grid-cols-4 gap-2">
              <div><Label className="text-[10px]">Baris</Label><Input type="number" value={objectForm.r} min={0} onChange={e => setObjectForm(p => ({ ...p, r: Math.max(0, parseInt(e.target.value) || 0) }))} className="h-8 text-sm" /></div>
              <div><Label className="text-[10px]">Kolom</Label><Input type="number" value={objectForm.c} min={0} onChange={e => setObjectForm(p => ({ ...p, c: Math.max(0, parseInt(e.target.value) || 0) }))} className="h-8 text-sm" /></div>
              <div><Label className="text-[10px]">Lebar</Label><Input type="number" value={objectForm.w} min={1} onChange={e => setObjectForm(p => ({ ...p, w: Math.max(1, parseInt(e.target.value) || 1) }))} className="h-8 text-sm" /></div>
              <div><Label className="text-[10px]">Tinggi</Label><Input type="number" value={objectForm.h} min={1} onChange={e => setObjectForm(p => ({ ...p, h: Math.max(1, parseInt(e.target.value) || 1) }))} className="h-8 text-sm" /></div>
            </div>
            <div><Label className="text-xs">Warna</Label><Input type="color" value={objectForm.color} onChange={e => setObjectForm(p => ({ ...p, color: e.target.value }))} className="h-9 w-16 p-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setObjectDialogOpen(false)}>Batal</Button>
            <Button size="sm" onClick={handleSaveObject} className="bg-charcoal hover:bg-charcoal/90 text-gold">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ SECTION EDIT DIALOG ═══════ */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden border-border/50">
          <div className="bg-gradient-to-br from-charcoal to-charcoal/95 px-5 pt-5 pb-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent" />
            <div className="relative">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-base font-serif text-warm-white">{editingSection ? 'Edit Seksion' : 'Tambah Seksion'}</DialogTitle>
              </DialogHeader>
            </div>
          </div>
          <div className="p-5 bg-warm-white space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-charcoal">Nama Seksion</Label>
              <Input value={sectionForm.name} onChange={e => setSectionForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="contoh: VIP, Regular, Student..." className="h-9 text-sm bg-white border-border/60" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-charcoal">Kolom Awal</Label>
                <Input type="number" value={sectionForm.fromRow + 1} min={1} max={seatColumns.length}
                  onChange={e => setSectionForm(prev => ({ ...prev, fromRow: Math.max(0, parseInt(e.target.value) - 1 || 0) }))}
                  className="h-9 text-sm bg-white border-border/60" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-charcoal">Kolom Akhir</Label>
                <Input type="number" value={sectionForm.toRow + 1} min={1} max={seatColumns.length}
                  onChange={e => setSectionForm(prev => ({ ...prev, toRow: Math.min(seatColumns.length - 1, parseInt(e.target.value) - 1 || 0) }))}
                  className="h-9 text-sm bg-white border-border/60" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-charcoal">Warna</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map(color => (
                  <button key={color}
                    className={cn('w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                      sectionForm.colorCode === color ? 'border-charcoal scale-110 ring-2 ring-offset-2 ring-gold/30' : 'border-transparent hover:border-charcoal/20')}
                    style={{ backgroundColor: color }}
                    onClick={() => setSectionForm(prev => ({ ...prev, colorCode: color }))} />
                ))}
              </div>
            </div>
            {sectionForm.name && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <div className="w-5 h-5 rounded-sm" style={{ backgroundColor: sectionForm.colorCode }} />
                <span className="text-xs text-charcoal font-medium">{sectionForm.name}</span>
                <span className="text-[10px] text-muted-foreground">Kolom {sectionForm.fromRow + 1}–{sectionForm.toRow + 1}</span>
              </div>
            )}
          </div>
          <DialogFooter className="px-5 pb-5 pt-2 bg-warm-white gap-2">
            <Button variant="ghost" onClick={() => setSectionDialogOpen(false)} className="text-muted-foreground">Batal</Button>
            <Button onClick={handleSaveSection} disabled={!sectionForm.name.trim()} className="bg-charcoal hover:bg-charcoal/90 text-gold text-sm">
              {editingSection ? 'Simpan' : 'Tambah'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
