'use client'

import React, { useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

interface DraggableObjectProps {
  id: string
  x: number
  y: number
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  isSelected?: boolean
  onSelect?: () => void
  onPositionChange: (pos: Bounds) => void
  isOverlapping?: boolean
  children: React.ReactNode
  disabled?: boolean
  className?: string
  // Show a label badge on the element
  label?: string
}

/**
 * DraggableObject — PowerPoint-style drag & resize wrapper.
 *
 * - Drag anywhere on the element to reposition (free-form pixel positioning)
 * - Resize handles on corners and edges when selected
 * - Visual overlap warning (orange border) when isOverlapping is true
 * - Visual selection indicator (blue border) when selected
 */
export function DraggableObject({
  id,
  x,
  y,
  width,
  height,
  minWidth = 60,
  minHeight = 40,
  isSelected = false,
  onSelect,
  onPositionChange,
  isOverlapping = false,
  disabled = false,
  children,
  className,
  label,
}: DraggableObjectProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ type: 'move' | 'resize'; handle: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, type: 'move' | 'resize', handle: string) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()
      onSelect?.()
      dragRef.current = {
        type,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origX: x,
        origY: y,
        origW: width,
        origH: height,
      }

      const handleMouseMove = (ev: MouseEvent) => {
        const drag = dragRef.current
        if (!drag) return

        const dx = ev.clientX - drag.startX
        const dy = ev.clientY - drag.startY

        // Get parent bounds for constraint
        const parent = elRef.current?.parentElement
        if (!parent) return
        const parentRect = parent.getBoundingClientRect()

        if (drag.type === 'move') {
          let newX = drag.origX + dx
          let newY = drag.origY + dy

          // Constrain to parent bounds (allow overflow by 50% for flexibility)
          const maxX = parentRect.width - width * 0.3
          const maxY = parentRect.height - height * 0.3
          newX = Math.max(-width * 0.7, Math.min(maxX, newX))
          newY = Math.max(-height * 0.5, Math.min(maxY, newY))

          onPositionChange({ x: Math.round(newX), y: Math.round(newY), width, height })
        } else {
          // Resize
          let newX = drag.origX
          let newY = drag.origY
          let newW = drag.origW
          let newH = drag.origH

          if (handle.includes('e')) newW = Math.max(minWidth, drag.origW + dx)
          if (handle.includes('w')) {
            const maxDx = drag.origW - minWidth
            const actualDx = Math.min(dx, maxDx)
            newW = drag.origW - actualDx
            newX = drag.origX + actualDx
          }
          if (handle.includes('s')) newH = Math.max(minHeight, drag.origH + dy)
          if (handle.includes('n')) {
            const maxDy = drag.origH - minHeight
            const actualDy = Math.min(dy, maxDy)
            newH = drag.origH - actualDy
            newY = drag.origY + actualDy
          }

          onPositionChange({
            x: Math.round(newX),
            y: Math.round(newY),
            width: Math.round(newW),
            height: Math.round(newH),
          })
        }
      }

      const handleMouseUp = () => {
        dragRef.current = null
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }

      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [disabled, onSelect, onPositionChange, x, y, width, height, minWidth, minHeight],
  )

  // Cursor styles for resize handles
  const handleCursor = (handle: string) => {
    if (disabled) return 'default'
    const map: Record<string, string> = {
      nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
      e: 'e-resize', se: 'se-resize', s: 's-resize',
      sw: 'sw-resize', w: 'w-resize',
    }
    return map[handle] || 'default'
  }

  return (
    <div
      ref={elRef}
      id={id}
      className={cn(
        'absolute group',
        !disabled && 'cursor-move',
        className,
      )}
      style={{
        left: x,
        top: y,
        width,
        height,
        zIndex: isSelected ? 20 : 10,
      }}
      onMouseDown={(e) => handleMouseDown(e, 'move', '')}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
    >
      {/* Overlap warning border */}
      {isOverlapping && (
        <div className="absolute inset-0 pointer-events-none rounded-md border-2 border-orange-400 animate-pulse" />
      )}

      {/* Selection border */}
      {isSelected && (
        <div className="absolute inset-0 pointer-events-none rounded-md border-2 border-blue-400" />
      )}

      {/* Content */}
      <div className="w-full h-full overflow-hidden rounded-md">
        {children}
      </div>

      {/* Label badge */}
      {label && isSelected && (
        <div className="absolute -top-5 left-0 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded-t font-medium whitespace-nowrap">
          {label}
        </div>
      )}

      {/* Resize handles — only when selected and not disabled */}
      {isSelected && !disabled && (
        <>
          {/* Corner handles */}
          {(['nw', 'ne', 'se', 'sw'] as const).map((handle) => {
            const positions: Record<string, string> = {
              nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
              ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
              se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
              sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
            }
            return (
              <div
                key={handle}
                className={cn(
                  'absolute w-2.5 h-2.5 bg-white border-2 border-blue-400 rounded-sm z-30 hover:bg-blue-100',
                  positions[handle],
                )}
                style={{ cursor: handleCursor(handle) }}
                onMouseDown={(e) => handleMouseDown(e, 'resize', handle)}
              />
            )
          })}
          {/* Edge handles */}
          {(['n', 's', 'w', 'e'] as const).map((handle) => {
            const positions: Record<string, string> = {
              n: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
              s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
              w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
              e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
            }
            const sizes: Record<string, string> = {
              n: 'w-4 h-1.5',
              s: 'w-4 h-1.5',
              w: 'w-1.5 h-4',
              e: 'w-1.5 h-4',
            }
            return (
              <div
                key={handle}
                className={cn(
                  'absolute bg-white border border-blue-400 rounded-sm z-30 hover:bg-blue-100',
                  positions[handle],
                  sizes[handle],
                )}
                style={{ cursor: handleCursor(handle) }}
                onMouseDown={(e) => handleMouseDown(e, 'resize', handle)}
              />
            )
          })}
        </>
      )}
    </div>
  )
}

/**
 * Check if two bounds overlap (AABB collision)
 */
export function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}
