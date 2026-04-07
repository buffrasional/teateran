// Shared seat layout parsing utilities
// Used by both the public seat map (seat-map.tsx) and the usher seat map view

export type LayoutObjectType = 'FOH' | 'ENTRANCE' | 'CUSTOM_SHAPE'

export interface LayoutObject {
  id: string
  type: LayoutObjectType
  label: string
  r: number
  c: number
  w: number
  h: number
  color: string
  // Pixel-based positions from canvas drag-and-drop (preferred for rendering)
  x?: number
  y?: number
  pixelW?: number
  pixelH?: number
}

/**
 * Canvas-to-guest-view coordinate transform computed from seatColumns.
 * Consumers use these bounds to map canvas pixel coords (stage, objects)
 * into guest-view grid coordinates.
 */
export interface CanvasSeatBounds {
  /** Canvas pixel X of the leftmost seat */
  originX: number
  /** Canvas pixel Y of the topmost seat */
  originY: number
  /** Canvas pixel span of the seat grid horizontally (rightmost right edge - leftmost left edge) */
  spanX: number
  /** Canvas pixel span of the seat grid vertically (bottommost bottom edge - topmost top edge) */
  spanY: number
}

export interface ParsedLayout {
  gridSize: { rows: number; cols: number }
  rowLabels: string[]
  sections: Array<{ name: string; fromRow: number; toRow: number; colorCode: string }>
  aisleColumns: number[]
  rowSeatMap: Map<number, Array<{ c: number; seatNum: number; block?: string }>>
  embeddedRows: Record<string, number> // source row index → target row index
  displayRows: number[] // row indices to actually render (excludes embedded source rows)
  objects?: LayoutObject[]
  stageType?: string
  /** Stage position in canvas pixel coordinates */
  stagePosition?: { x: number; y: number; width: number; height: number }
  thrustWidth?: number
  thrustDepth?: number
  canvasWidth?: number
  canvasHeight?: number
  /** Bounding box of seats in canvas pixel space (for coordinate mapping) */
  canvasSeatBounds?: CanvasSeatBounds
}

/**
 * Infer blocks for a row based on column position patterns.
 * Detects center rows (small cluster in middle) vs left+right rows (gap in middle).
 */
function inferBlocksForRow(
  rowSeats: Array<{ c: number }>
): Array<string> {
  if (rowSeats.length === 0) return []

  const sorted = [...rowSeats].sort((a, b) => a.c - b.c)
  const n = sorted.length

  // Find the largest gap between consecutive seats
  let maxGap = 0
  let maxGapIdx = -1
  for (let i = 1; i < n; i++) {
    const gap = sorted[i].c - sorted[i - 1].c - 1
    if (gap > maxGap) {
      maxGap = gap
      maxGapIdx = i
    }
  }

  // Small row (<=4 seats) with no big gap → center
  if (n <= 4 && maxGap <= 2) {
    return sorted.map(() => 'center')
  }

  // Large gap (>=4 empty columns) → split into left/right
  if (maxGap >= 4) {
    return sorted.map((_, i) => (i < maxGapIdx ? 'left' : 'right'))
  }

  // Medium gap (2-3 empty columns) → split there
  if (maxGap >= 2 && maxGapIdx > 0 && maxGapIdx < n) {
    return sorted.map((_, i) => (i < maxGapIdx ? 'left' : 'right'))
  }

  // No significant gap but wide span → split at midpoint
  const minC = sorted[0].c
  const maxC = sorted[n - 1].c
  const midCol = (minC + maxC) / 2
  return sorted.map((s) => (s.c <= midCol ? 'left' : 'right'))
}

function inferEmbeddedRows(
  rowSeatMap: Map<number, Array<{ c: number; seatNum: number; block?: string }>>,
  totalRows: number,
  cols: number
): Record<string, number> {
  const embedded: Record<string, number> = {}
  const maxEmbedSearch = Math.min(6, totalRows)

  const candidates: number[] = []
  for (let r = 0; r < maxEmbedSearch; r++) {
    const rowSeats = rowSeatMap.get(r)
    if (!rowSeats || rowSeats.length === 0) continue
    const blocks = inferBlocksForRow(rowSeats)
    const allCenter = blocks.every((b) => b === 'center')
    if (allCenter && rowSeats.length <= 4) {
      candidates.push(r)
    } else {
      break
    }
  }

  if (candidates.length === 0) return embedded

  const lastCandidate = candidates[candidates.length - 1]
  const targets: number[] = []
  for (let tr = lastCandidate + 1; tr < totalRows; tr++) {
    const targetSeats = rowSeatMap.get(tr)
    if (!targetSeats || targetSeats.length === 0) continue
    const targetBlocks = inferBlocksForRow(targetSeats)
    if (targetBlocks.includes('left') && targetBlocks.includes('right')) {
      targets.push(tr)
    }
    if (targets.length >= candidates.length) break
  }

  for (let i = 0; i < Math.min(candidates.length, targets.length); i++) {
    embedded[String(candidates[i])] = targets[i]
  }

  return embedded
}

export function parseLayoutData(layoutData: any): ParsedLayout | null {
  if (!layoutData) return null
  const data = typeof layoutData === 'string' ? JSON.parse(layoutData) : layoutData
  if (!data || data.type !== 'NUMBERED' || !data.gridSize) return null

  const rawSeats: any[] = data.seats || []
  const rowLabels: string[] = data.rowLabels || []
  const sections = data.sections || []
  const aisleColumns: number[] = Array.isArray(data.aisleColumns) ? data.aisleColumns : []
  const { rows, cols } = data.gridSize

  // Group by row and assign seat numbers
  const rowGroups: Record<number, any[]> = {}
  for (const s of rawSeats) {
    const r = s.r ?? s.row ?? 0
    if (!rowGroups[r]) rowGroups[r] = []
    rowGroups[r].push(s)
  }

  const rowSeatMap = new Map<number, Array<{ c: number; seatNum: number; block?: string }>>()
  for (const [rStr, rowSeats] of Object.entries(rowGroups)) {
    const r = parseInt(rStr)
    const sorted = [...rowSeats].sort((a: any, b: any) => (a.c ?? a.col ?? 0) - (b.c ?? b.col ?? 0))

    // Deduplicate c values within each row: if two seats share the same c,
    // shift the later one(s) right. This prevents Map.set from silently
    // overwriting duplicates in the grid renderer.
    const deduped: typeof sorted = []
    const usedC = new Set<number>()
    for (const s of sorted) {
      let c = s.c ?? s.col ?? 0
      while (usedC.has(c)) c++
      usedC.add(c)
      deduped.push({ ...s, c })
    }

    // Infer blocks AFTER dedup so positions are accurate
    const allHaveBlock = deduped.every((s: any) => s.block)
    let inferredBlocks: string[] | null = null
    if (!allHaveBlock) {
      inferredBlocks = inferBlocksForRow(deduped.map((s: any) => ({ c: s.c })))
    }

    rowSeatMap.set(r, deduped.map((s: any, idx: number) => ({
      c: s.c,
      seatNum: idx + 1,
      block: s.block || (inferredBlocks ? inferredBlocks[idx] : undefined),
    })))
  }

  let embeddedRows: Record<string, number> = data.embeddedRows || {}
  if (Object.keys(embeddedRows).length === 0) {
    embeddedRows = inferEmbeddedRows(rowSeatMap, rows, cols)
  }

  const embeddedSourceRows = new Set(Object.keys(embeddedRows).map(Number))
  const displayRows: number[] = []
  for (let r = 0; r < rows; r++) {
    if (!embeddedSourceRows.has(r)) {
      displayRows.push(r)
    }
  }

  // Parse non-clickable objects (preserve pixel positions from canvas editor)
  const objects: LayoutObject[] = Array.isArray(data.objects)
    ? data.objects.map((o: any) => ({
        id: o.id || `obj-${Math.random().toString(36).slice(2, 8)}`,
        type: (o.type || 'CUSTOM_SHAPE') as LayoutObjectType,
        label: o.label || '',
        r: o.r ?? 0,
        c: o.c ?? 0,
        w: o.w ?? 1,
        h: o.h ?? 1,
        color: o.color || '#6B7280',
        // Preserve pixel-based positions from canvas drag-and-drop
        ...(typeof o.x === 'number' && { x: o.x }),
        ...(typeof o.y === 'number' && { y: o.y }),
        ...(typeof o.pixelW === 'number' && { pixelW: o.pixelW }),
        ...(typeof o.pixelH === 'number' && { pixelH: o.pixelH }),
      }))
    : []

  // Parse stage type and position
  const stageType: string = data.stageType || 'PROSCENIUM'
  const stagePosition = (data.stagePosition && typeof data.stagePosition === 'object' && typeof data.stagePosition.x === 'number')
    ? { x: data.stagePosition.x, y: data.stagePosition.y, width: data.stagePosition.width || 320, height: data.stagePosition.height || 60 }
    : undefined
  const thrustWidth = data.thrustWidth || undefined
  const thrustDepth = data.thrustDepth || undefined

  const canvasWidth = typeof data.canvasWidth === 'number' ? data.canvasWidth : undefined
  const canvasHeight = typeof data.canvasHeight === 'number' ? data.canvasHeight : undefined

  // Compute canvas seat bounds from seatColumns for coordinate mapping.
  // This allows consumers to map stage/objects canvas pixel positions
  // to the guest-view grid coordinate system.
  let canvasSeatBounds: CanvasSeatBounds | undefined
  const SNAP = 32
  const PAINTED_SEAT = 28
  if (Array.isArray(data.seatColumns) && data.seatColumns.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const col of data.seatColumns) {
      if (!Array.isArray(col.seats)) continue
      for (const s of col.seats) {
        const sx = typeof s.x === 'number' ? s.x : 0
        const sy = typeof s.y === 'number' ? s.y : 0
        if (sx < minX) minX = sx
        if (sy < minY) minY = sy
        if (sx + PAINTED_SEAT > maxX) maxX = sx + PAINTED_SEAT
        if (sy + PAINTED_SEAT > maxY) maxY = sy + PAINTED_SEAT
      }
    }
    if (minX < Infinity && minY < Infinity) {
      canvasSeatBounds = {
        originX: minX,
        originY: minY,
        spanX: Math.max(maxX - minX, PAINTED_SEAT),
        spanY: Math.max(maxY - minY, PAINTED_SEAT),
      }
    }
  }

  return { gridSize: { rows, cols }, rowLabels, sections, aisleColumns, rowSeatMap, embeddedRows, displayRows, objects, stageType, stagePosition, thrustWidth, thrustDepth, canvasWidth, canvasHeight, canvasSeatBounds }
}
