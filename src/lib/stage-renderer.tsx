'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export type StageType = 'PROSCENIUM' | 'AMPHITHEATER' | 'BLACK_BOX' | 'THRUST' | 'ARENA'

interface StageRendererProps {
  stageType?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  // Thrust customization (only for THRUST type)
  thrustWidth?: number    // 30-100, percentage of total width
  thrustDepth?: number    // 1-8, number of grid rows for extension
  // Fill parent container (for draggable stage in editor)
  fillParent?: boolean
}

const SIZE_CLASSES = {
  sm: { container: 'max-w-xs py-2 px-6', main: 'text-[10px] sm:text-xs', sub: 'text-[8px] sm:text-[10px]', scale: 0.7 },
  md: { container: 'max-w-sm py-3 px-8', main: 'text-sm sm:text-base', sub: 'text-[10px] sm:text-xs', scale: 1 },
  lg: { container: 'max-w-md py-5 px-8', main: 'text-lg sm:text-xl', sub: 'text-xs sm:text-sm', scale: 1.3 },
}

export function StageRenderer({ stageType = 'PROSCENIUM', size = 'md', className, thrustWidth = 45, thrustDepth = 3, fillParent = false }: StageRendererProps) {
  const sz = SIZE_CLASSES[size]

  const label = (
    <div className="text-center relative z-10">
      <p className={cn('font-serif text-gold tracking-[0.3em] font-semibold', fillParent ? 'text-[10px] sm:text-xs' : sz.main)}>
        S T A G E
      </p>
    </div>
  )

  // Shared fill-parent stage inner box
  const fillParentInner = (
    <div className={cn('bg-charcoal rounded-xl border border-gold/20 stage-glow text-center flex items-center justify-center w-full h-full px-4', className)}>
      {label}
    </div>
  )

  switch (stageType) {
    case 'AMPHITHEATER': {
      // Amphitheater: semicircular stage — audience sits in curved/arc rows
      // wrapping around a central stage area. Stage is wider and rounded.
      if (fillParent) {
        return (
          <div className={cn('flex justify-center w-full h-full', className)}>
            <div className={cn('bg-charcoal border border-gold/20 stage-glow text-center overflow-hidden relative w-full h-full flex items-center justify-center px-4')}
              style={{ borderRadius: '50% 50% 12% 12%' }}
            >
              {label}
            </div>
          </div>
        )
      }
      return (
        <div className={cn('mb-5 flex justify-center', className)}>
          <div
            className={cn(
              'bg-charcoal border border-gold/20 stage-glow text-center overflow-hidden relative',
              sz.container,
              'py-6 px-8'
            )}
            style={{
              borderRadius: '50% 50% 12% 12%',
              maxWidth: size === 'sm' ? 320 : size === 'md' ? 420 : 520,
            }}
          >
            {/* Curved seating indicators at bottom */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1 opacity-30">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-0.5 rounded-full bg-gold"
                  style={{
                    width: `${30 + i * 12}px`,
                    borderRadius: '9999px',
                  }}
                />
              ))}
            </div>
            {label}
          </div>
        </div>
      )
    }

    case 'THRUST': {
      // Thrust stage (panggung tonjok): Main proscenium stage at back,
      // with a T-shaped extension jutting into the audience seating area.
      // Audience sits on 3 sides of the extension.
      // thrustWidth controls how wide the extension is (30-100%)
      // thrustDepth controls how far it extends into the audience (1-8 rows)
      if (fillParent) {
        const extWidth = Math.max(30, Math.min(100, thrustWidth))
        return (
          <div className={cn('flex flex-col items-center w-full h-full', className)}>
            <div className={cn('bg-charcoal border border-b-0 border-gold/20 stage-glow flex-1 w-full flex items-center justify-center rounded-t-xl')} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
              {label}
            </div>
            <div className="bg-charcoal border-x border-b border-gold/20 stage-glow relative" style={{ width: `${extWidth}%`, height: 20, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, minWidth: 60 }} />
          </div>
        )
      }
      const extWidth = Math.max(30, Math.min(100, thrustWidth))
      const extDepth = Math.max(1, Math.min(8, thrustDepth))
      const extHeightPx = extDepth * 8 * sz.scale

      return (
        <div className={cn('mb-5 flex flex-col items-center', className)}>
          {/* Main back stage (proscenium-like) */}
          <div
            className={cn(
              'bg-charcoal border border-gold/20 stage-glow',
              sz.container
            )}
            style={{
              borderBottom: 'none',
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            }}
          >
            {label}
          </div>
          {/* Thrust extension — narrower T-shape going into audience */}
          <div
            className="bg-charcoal border-x border-b border-gold/20 stage-glow relative"
            style={{
              width: `${extWidth}%`,
              height: `${extHeightPx}px`,
              borderBottomLeftRadius: 6,
              borderBottomRightRadius: 6,
              minWidth: 80,
            }}
          >
            {/* Side audience indicators */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-1 flex flex-col gap-1 opacity-30">
              {Array.from({ length: Math.min(extDepth, 4) }).map((_, i) => (
                <div key={`l${i}`} className="w-1.5 h-1.5 rounded-full bg-gold/60" />
              ))}
            </div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-1 flex flex-col gap-1 opacity-30">
              {Array.from({ length: Math.min(extDepth, 4) }).map((_, i) => (
                <div key={`r${i}`} className="w-1.5 h-1.5 rounded-full bg-gold/60" />
              ))}
            </div>
          </div>
        </div>
      )
    }

    case 'BLACK_BOX': {
      // Black Box: Flexible/performance space with a raised square platform
      // in the CENTER of the seating area. Audience sits on all sides
      // (typically 3 or 4 sides). The stage is more intimate, smaller.
      if (fillParent) {
        return (
          <div className={cn('flex justify-center items-center w-full h-full', className)}>
            <div className={cn('bg-charcoal border-2 border-dashed border-gold/30 stage-glow text-center relative w-full h-full flex items-center justify-center')} style={{ borderRadius: 4 }}>
              {label}
              <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-gold/40" />
              <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-gold/40" />
              <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-gold/40" />
              <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-gold/40" />
            </div>
          </div>
        )
      }
      return (
        <div className={cn('mb-5 flex justify-center', className)}>
          <div className="relative flex flex-col items-center">
            {/* Audience area indicator (top rows) */}
            <div className="flex items-center gap-1 mb-2 opacity-25">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="w-2 h-1 rounded-full bg-gold" />
              ))}
            </div>

            {/* Center stage */}
            <div
              className={cn(
                'bg-charcoal border-2 border-dashed border-gold/30 stage-glow text-center relative',
              )}
              style={{
                borderRadius: 4,
                width: size === 'sm' ? 140 : size === 'md' ? 180 : 220,
                height: size === 'sm' ? 90 : size === 'md' ? 110 : 130,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {label}
              {/* Corner markers */}
              <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-gold/40" />
              <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-gold/40" />
              <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-gold/40" />
              <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-gold/40" />
              {/* Side audience indicators */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 flex flex-col gap-1.5 opacity-25">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-gold" />
                ))}
              </div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-2 flex flex-col gap-1.5 opacity-25">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-gold" />
                ))}
              </div>
            </div>

            {/* Audience area indicator (bottom rows) */}
            <div className="flex items-center gap-1 mt-2 opacity-25">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="w-2 h-1 rounded-full bg-gold" />
              ))}
            </div>
          </div>
        </div>
      )
    }

    case 'ARENA': {
      // Arena / Theater-in-the-round: Central stage completely surrounded
      // by audience on all 4 sides. Like a boxing ring or circular performance.
      // The stage is typically circular/oval in the center.
      if (fillParent) {
        return (
          <div className={cn('flex justify-center items-center w-full h-full', className)}>
            <div className={cn('bg-charcoal border border-gold/20 stage-glow text-center overflow-hidden w-full h-full flex items-center justify-center')} style={{ borderRadius: '50%' }}>
              {label}
            </div>
          </div>
        )
      }
      const diameter = size === 'sm' ? 160 : size === 'md' ? 200 : 250

      return (
        <div className={cn('mb-5 flex justify-center', className)}>
          <div className="relative flex flex-col items-center">
            {/* Top audience indicator */}
            <div className="flex items-center gap-1 mb-3 opacity-25">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-2 h-1 rounded-full bg-gold" />
              ))}
            </div>

            <div className="flex items-center gap-4">
              {/* Left audience indicator */}
              <div className="flex flex-col items-center gap-1 opacity-25">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="w-1 h-2 rounded-full bg-gold" />
                ))}
              </div>

              {/* Central oval stage */}
              <div
                className={cn(
                  'bg-charcoal border border-gold/20 stage-glow text-center overflow-hidden',
                )}
                style={{
                  borderRadius: '50%',
                  width: diameter,
                  height: diameter * 0.55,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {label}
              </div>

              {/* Right audience indicator */}
              <div className="flex flex-col items-center gap-1 opacity-25">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="w-1 h-2 rounded-full bg-gold" />
                ))}
              </div>
            </div>

            {/* Bottom audience indicator */}
            <div className="flex items-center gap-1 mt-3 opacity-25">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-2 h-1 rounded-full bg-gold" />
              ))}
            </div>
          </div>
        </div>
      )
    }

    case 'PROSCENIUM':
    default: {
      // Proscenium: Standard stage at front, audience faces it from one direction.
      // The most common theater layout — rectangular stage with an arch frame.
      if (fillParent) {
        return (
          <div className={cn('flex justify-center w-full h-full', className)}>
            <div className={cn('bg-charcoal rounded-xl border border-gold/20 stage-glow text-center flex items-center justify-center w-full h-full px-4')}>
              {label}
            </div>
          </div>
        )
      }
      return (
        <div className={cn('mb-5 flex justify-center', className)}>
          <div className={cn('bg-charcoal rounded-xl border border-gold/20 stage-glow text-center', sz.container)}>
            {label}
          </div>
        </div>
      )
    }
  }
}

/** Renders non-clickable objects overlay on the grid */
export function ObjectsOverlay({
  objects,
  cellSize = 28,
  offsetX = 0,
  className,
  canvasSeatBounds,
  gridCols = 0,
  gridRows = 0,
  paddingTop = 0,
}: {
  objects?: Array<{ id: string; type: string; label: string; r: number; c: number; w: number; h: number; color: string; x?: number; y?: number; pixelW?: number; pixelH?: number }>
  cellSize?: number
  offsetX?: number
  className?: string
  /** Canvas seat bounding box (originX, originY, spanX, spanY) for coordinate mapping */
  canvasSeatBounds?: { originX: number; originY: number; spanX: number; spanY: number }
  /** Number of grid columns in the guest view */
  gridCols?: number
  /** Number of display rows in the guest view grid */
  gridRows?: number
  /** Extra padding-top on the container (for elements above the seat grid) */
  paddingTop?: number
}) {
  if (!objects || objects.length === 0) return null

  const PAINTED = 28

  return (
    <div className={cn('absolute pointer-events-none', className)} style={{ top: 0, left: 0 }}>
      {objects.map((obj) => {
        const hasPixelPos = typeof obj.x === 'number' && typeof obj.y === 'number'
        let posX: number, posY: number, posW: number, posH: number

        if (hasPixelPos && canvasSeatBounds && gridCols > 0 && gridRows > 0) {
          // Map canvas pixel position → guest view grid coordinates.
          // The canvas seat bounding box maps to the guest grid area:
          //   canvas (originX, originY, spanX, spanY) → guest (offsetX, paddingTop, gridCols*cell, gridRows*cell)
          const b = canvasSeatBounds
          const guestGridW = gridCols * cellSize
          const guestGridH = gridRows * cellSize
          const objW = obj.pixelW || obj.w * PAINTED
          const objH = obj.pixelH || obj.h * PAINTED

          posX = offsetX + ((obj.x! - b.originX) / b.spanX) * guestGridW
          posY = paddingTop + ((obj.y! - b.originY) / b.spanY) * guestGridH
          posW = (objW / b.spanX) * guestGridW
          posH = (objH / b.spanY) * guestGridH
        } else if (hasPixelPos) {
          // No bounds info — use raw pixels (fallback)
          posX = obj.x!
          posY = obj.y!
          posW = obj.pixelW || obj.w * cellSize
          posH = obj.pixelH || obj.h * cellSize
        } else {
          // Grid-based r,c positioning
          posX = offsetX + obj.c * cellSize
          posY = paddingTop + obj.r * cellSize
          posW = obj.w * cellSize
          posH = obj.h * cellSize
        }

        return (
          <div
            key={obj.id}
            className="absolute flex items-center justify-center overflow-hidden"
            style={{
              left: posX,
              top: posY,
              width: posW,
              height: posH,
              backgroundColor: obj.color + '25',
              border: `2px dashed ${obj.color}80`,
              borderRadius: 4,
            }}
          >
            <div className="text-center px-1">
              <span
                className="text-[8px] sm:text-[9px] font-bold leading-tight block truncate max-w-full"
                style={{ color: obj.color }}
              >
                {obj.type === 'ENTRANCE' ? '🚪 ' : ''}
                {obj.label || obj.type}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
