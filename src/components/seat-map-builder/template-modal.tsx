'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Drama, Square, RotateCcw, Plus, Sparkles } from 'lucide-react'

interface TemplateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (template: { name: string; layoutData: any }) => void
}

// ─────────────────────────────────────────────────
// Pre-built template layout data
// ─────────────────────────────────────────────────

function buildRendraAuditorium() {
  // ═══════════════════════════════════════════════════════════════
  // AUDITORIUM RENDRA — 142 SEATS
  // Funnel-shaped, edge-aligned (KIRI RATA KIRI, KANAN RATA KANAN)
  //
  // Visual layout (top to bottom = back to front):
  //   M: [8 left] | gap | [8 right]          (16 seats)
  //   L: [8 left] | gap | [8 right]          (16 seats)
  //   K: [8 left] | gap | [8 right]          (16 seats)
  //   J: [8 left] | gap | [8 right]          (16 seats)
  //   I: [6 left] | gap gap | [6 right]      (12 seats)
  //   H: [6 left] | gap gap | [6 right]      (12 seats)
  //   G: [6 left] | gap gap | [6 right]      (12 seats)
  //   F: [6 left] | gap gap | [6 right]      (12 seats)
  //   E: [5 left] | gap gap gap | [5 right]  (10 seats)
  //   D: [4 left] | B1 B2 | [4 right]       (8+2=10 seats)
  //   C: [4 left] | A1 A2 | [4 right]       (8+2=10 seats)
  //                     PANGGUNG / LAYAR
  //
  // IMPORTANT: Row A (A1,A2) is EMBEDDED in Row C's center gap.
  // IMPORTANT: Row B (B1,B2) is EMBEDDED in Row D's center gap.
  // embeddedRows: { sourceRowIndex: targetRowIndex }
  //   Row 0 (A) → embedded in Row 2 (C)
  //   Row 1 (B) → embedded in Row 3 (D)
  // ═══════════════════════════════════════════════════════════════
  const rowLabels = ['A','B','C','D','E','F','G','H','I','J','K','L','M']
  const COLS = 20
  const rows = 13

  // [leftBlock, rightBlock] — center rows (A,B) are handled separately
  const config: Array<{ left: number; right: number }> = [
    { left: 0, right: 0 }, // A (ri=0) — center only, embedded in C
    { left: 0, right: 0 }, // B (ri=1) — center only, embedded in D
    { left: 4, right: 4 }, // C (ri=2) — left + right with A1,A2 center
    { left: 4, right: 4 }, // D (ri=3) — left + right with B1,B2 center
    { left: 5, right: 5 }, // E (ri=4)
    { left: 6, right: 6 }, // F (ri=5)
    { left: 6, right: 6 }, // G (ri=6)
    { left: 6, right: 6 }, // H (ri=7)
    { left: 6, right: 6 }, // I (ri=8)
    { left: 8, right: 8 }, // J (ri=9)
    { left: 8, right: 8 }, // K (ri=10)
    { left: 8, right: 8 }, // L (ri=11)
    { left: 8, right: 8 }, // M (ri=12)
  ]

  const seats: { r: number; c: number; block: string }[] = []

  // Row A (index 0): 2 center seats, positioned at center of the grid
  const centerStartA = Math.floor((COLS - 2) / 2)
  seats.push({ r: 0, c: centerStartA, block: 'center' })
  seats.push({ r: 0, c: centerStartA + 1, block: 'center' })

  // Row B (index 1): 2 center seats, positioned at center of the grid
  const centerStartB = Math.floor((COLS - 2) / 2)
  seats.push({ r: 1, c: centerStartB, block: 'center' })
  seats.push({ r: 1, c: centerStartB + 1, block: 'center' })

  // Rows C through M: left block flush left, right block flush right
  for (let ri = 2; ri < config.length; ri++) {
    const { left, right } = config[ri]
    // Left block: starts at col 0 (KIRI RATA KIRI)
    for (let i = 0; i < left; i++) {
      seats.push({ r: ri, c: i, block: 'left' })
    }
    // Right block: ends at col COLS-1 (KANAN RATA KANAN)
    for (let i = 0; i < right; i++) {
      seats.push({ r: ri, c: COLS - right + i, block: 'right' })
    }
  }

  // Verify: 2 + 2 + (4+4) + (4+4) + (5+5)*1 + (6+6)*4 + (8+8)*4
  // = 4 + 8 + 8 + 10 + 48 + 64 = 142
  const totalSeats = seats.length
  if (totalSeats !== 142) {
    console.error(`[buildRendraAuditorium] WARNING: Expected 142 seats but got ${totalSeats}`)
  }

  return {
    type: 'NUMBERED',
    gridSize: { rows, cols: COLS },
    aisleColumns: [] as number[],
    rowLabels,
    seats,
    // Embedded rows: source row index → target row index
    // Row A (0) is embedded in Row C (2) — A1,A2 render in C's center gap
    // Row B (1) is embedded in Row D (3) — B1,B2 render in D's center gap
    embeddedRows: {
      '0': 2,  // A → C
      '1': 3,  // B → D
    } as Record<string, number>,
    sections: [
      { name: 'VIP',     fromRow: 0, toRow: 3,  colorCode: '#C8A951' },
      { name: 'Regular', fromRow: 4, toRow: 7,  colorCode: '#8B8680' },
      { name: 'Student', fromRow: 8, toRow: 12, colorCode: '#7BA7A5' },
    ],
  }
}

function buildBlackBox() {
  const rows = 10
  const cols = 10
  const rowLabels = Array.from({ length: rows }, (_, i) => String.fromCharCode(65 + i))

  const seats: { r: number; c: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      seats.push({ r, c })
    }
  }

  return {
    type: 'NUMBERED',
    gridSize: { rows, cols },
    aisleColumns: [] as number[],
    rowLabels,
    seats,
    sections: [
      { name: 'Regular', fromRow: 0, toRow: 9, colorCode: '#8B8680' },
    ],
  }
}

function buildArena() {
  return {
    type: 'GENERAL_ADMISSION',
    gridSize: { rows: 12, cols: 14 },
    zones: [
      { id: 'stage', name: 'Panggung', r: 0, c: 4, w: 6, h: 2, capacity: 0, colorCode: '#3D3D3D' },
      { id: 'festival-front', name: 'Festival Depan', r: 3, c: 2, w: 10, h: 3, capacity: 120, colorCode: '#C8A951' },
      { id: 'festival-back', name: 'Festival Belakang', r: 7, c: 2, w: 10, h: 3, capacity: 150, colorCode: '#7BA7A5' },
      { id: 'left-wing', name: 'Sayap Kiri', r: 3, c: 0, w: 1, h: 7, capacity: 30, colorCode: '#8B8680' },
      { id: 'right-wing', name: 'Sayap Kanan', r: 3, c: 13, w: 1, h: 7, capacity: 30, colorCode: '#8B8680' },
    ],
  }
}

function buildBlankCanvas() {
  return {
    type: 'NUMBERED',
    gridSize: { rows: 8, cols: 10 },
    aisleColumns: [] as number[],
    rowLabels: Array.from({ length: 8 }, (_, i) => String.fromCharCode(65 + i)),
    seats: [] as { r: number; c: number }[],
    sections: [] as { name: string; fromRow: number; toRow: number; colorCode: string }[],
  }
}

// ─────────────────────────────────────────────────
// Template definitions
// ─────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'rendra',
    name: 'Auditorium Rendra',
    description: '142 kursi funnel-shaped asimetris, baris A-M dengan lorong tengah.',
    icon: Drama,
    accentColor: '#C8A951',
    builder: buildRendraAuditorium,
  },
  {
    id: 'blackbox',
    name: 'Black Box',
    description: 'Grid 10×10 padat, cocok untuk pertunjukan intim.',
    icon: Square,
    accentColor: '#7BA7A5',
    builder: buildBlackBox,
  },
  {
    id: 'arena',
    name: 'Arena',
    description: 'Tata letak 4 sisi panggung untuk pengalaman 360°.',
    icon: RotateCcw,
    accentColor: '#8B8680',
    builder: buildArena,
  },
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Mulai dari nol, kreasikan tata letak sendiri.',
    icon: Plus,
    accentColor: '#1A1A2E',
    builder: buildBlankCanvas,
  },
] as const

// ─────────────────────────────────────────────────
// Template Modal Component
// ─────────────────────────────────────────────────

export function TemplateModal({ open, onOpenChange, onSelect }: TemplateModalProps) {
  const handleSelect = (template: (typeof TEMPLATES)[number]) => {
    const layoutData = template.builder()
    onSelect({ name: template.name, layoutData })
    // Do NOT call onOpenChange(false) here — the parent handles navigation
    // after template selection (e.g., advancing to metadata step).
    // Calling it would cause a premature redirect back to the list page.
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-0 gap-0 overflow-hidden border-border/50">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-charcoal to-charcoal/95 px-6 pt-6 pb-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent" />
          <div className="relative">
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-gold" />
                <DialogTitle className="text-xl font-serif text-warm-white">
                  Pilih Template
                </DialogTitle>
              </div>
              <DialogDescription className="text-warm-white/60 text-sm leading-relaxed">
                Mulai dengan template atau buat dari nol. Template dapat diedit sesuai kebutuhan.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Template grid */}
        <div className="p-6 bg-warm-white">
          <div className="grid grid-cols-2 gap-4">
            {TEMPLATES.map((template) => {
              const Icon = template.icon
              return (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  className={cn(
                    'group relative flex flex-col items-start gap-3 rounded-xl border border-border/60 p-4',
                    'bg-white transition-all duration-200',
                    'hover:border-gold/40 hover:shadow-lg hover:shadow-gold/5',
                    'hover:-translate-y-0.5 active:translate-y-0',
                    'text-left cursor-pointer'
                  )}
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200"
                    style={{
                      backgroundColor: template.accentColor + '15',
                    }}
                  >
                    <Icon
                      className="w-5 h-5 transition-colors duration-200"
                      style={{ color: template.accentColor }}
                    />
                  </div>

                  {/* Content */}
                  <div className="space-y-1">
                    <h3 className="font-serif font-semibold text-charcoal text-sm group-hover:text-gold-dark transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {template.description}
                    </p>
                  </div>

                  {/* Hover border accent */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{ backgroundColor: template.accentColor }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
