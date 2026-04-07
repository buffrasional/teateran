'use client'

import { io, Socket } from 'socket.io-client'
import { useEffect, useRef, useState, useCallback } from 'react'

// ===========================
// Types
// ===========================

export interface SeatLockedPayload {
  eventId: string
  seatCode: string
  sessionId: string
  lockedAt: number
  lockedUntil: number
}

export interface SeatUnlockedPayload {
  eventId: string
  seatCode: string
  unlockedBy: string
  reason?: string
}

export interface SeatSoldPayload {
  eventId: string
  seatCode: string
  soldAt: number
}

export interface AllSeatsStatusPayload {
  eventId: string
  seats: Array<{
    seatCode: string
    status: string
    sessionId: string
    lockedUntil: number
  }>
}

export interface UserCountPayload {
  eventId: string
  count: number
}

export interface SeatLockRejectedPayload {
  eventId: string
  seatCode: string
  reason: string
  existingSessionId?: string
}

export interface SeatsLockRejectedPayload {
  eventId: string
  rejectedSeats: Array<{ seatCode: string; reason: string }>
}

export interface SeatUnlockRejectedPayload {
  eventId: string
  seatCode: string
  reason: string
}

// ===========================
// Hook: useSeatSocket
// Connects to the Seat Socket.io service and provides real-time seat operations.
// ===========================

export function useSeatSocket(eventId: string | null) {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [userCount, setUserCount] = useState(0)

  // Stable callback refs to avoid re-attaching listeners
  const onSeatLockedRef = useRef<((payload: SeatLockedPayload) => void) | null>(null)
  const onSeatUnlockedRef = useRef<((payload: SeatUnlockedPayload) => void) | null>(null)
  const onSeatSoldRef = useRef<((payload: SeatSoldPayload) => void) | null>(null)
  const onAllSeatsStatusRef = useRef<((payload: AllSeatsStatusPayload) => void) | null>(null)
  const onSeatLockRejectedRef = useRef<((payload: SeatLockRejectedPayload) => void) | null>(null)
  const onSeatUnlockRejectedRef = useRef<((payload: SeatUnlockRejectedPayload) => void) | null>(null)
  const onSeatsLockRejectedRef = useRef<((payload: SeatsLockRejectedPayload) => void) | null>(null)

  // ---- Initialize socket connection ----
  useEffect(() => {
    if (!eventId) return

    // Create Socket.io connection via Caddy reverse proxy
    const socket: Socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })

    socketRef.current = socket

    // ---- Connection events ----
    socket.on('connect', () => {
      console.log(`[useSeatSocket] Connected to seat service, socket.id=${socket.id}`)
      setIsConnected(true)
      // Join the event room — server will send current lock state on join
      socket.emit('join_event', { eventId })
    })

    socket.on('disconnect', (reason) => {
      console.log(`[useSeatSocket] Disconnected: ${reason}`)
      setIsConnected(false)
    })

    socket.on('connect_error', (error) => {
      // Gracefully degrade - socket service may not be running
      if (socketRef.current?.active && !isConnected) {
        console.warn(`[useSeatSocket] Socket service unavailable, falling back to API-only mode`)
      }
      setIsConnected(false)
    })

    // ---- Seat events ----
    socket.on('seat_locked', (payload: SeatLockedPayload) => {
      onSeatLockedRef.current?.(payload)
    })

    socket.on('seat_unlocked', (payload: SeatUnlockedPayload) => {
      onSeatUnlockedRef.current?.(payload)
    })

    socket.on('seat_sold', (payload: SeatSoldPayload) => {
      onSeatSoldRef.current?.(payload)
    })

    socket.on('all_seats_status', (payload: AllSeatsStatusPayload) => {
      onAllSeatsStatusRef.current?.(payload)
    })

    socket.on('user_count', (payload: UserCountPayload) => {
      setUserCount(payload.count)
    })

    socket.on('seat_lock_rejected', (payload: SeatLockRejectedPayload) => {
      onSeatLockRejectedRef.current?.(payload)
    })

    socket.on('seat_unlock_rejected', (payload: SeatUnlockRejectedPayload) => {
      onSeatUnlockRejectedRef.current?.(payload)
    })

    socket.on('seats_lock_rejected', (payload: SeatsLockRejectedPayload) => {
      onSeatsLockRejectedRef.current?.(payload)
    })

    // ---- Cleanup on unmount ----
    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [eventId])

  // ---- Actions ----

  const lockSeat = useCallback(
    (seatCode: string, sessionId: string) => {
      if (socketRef.current && isConnected && eventId) {
        socketRef.current.emit('lock_seat', { eventId, seatCode, sessionId })
      }
    },
    [isConnected, eventId]
  )

  const unlockSeat = useCallback(
    (seatCode: string, sessionId?: string) => {
      if (socketRef.current && isConnected && eventId) {
        socketRef.current.emit('unlock_seat', { eventId, seatCode, sessionId })
      }
    },
    [isConnected, eventId]
  )

  // Bulk lock — sends all selected seats in ONE message, ensuring atomic broadcast
  const lockSeats = useCallback(
    (seatCodes: string[], sessionId: string) => {
      if (socketRef.current && isConnected && eventId && seatCodes.length > 0) {
        socketRef.current.emit('lock_seats', { eventId, seatCodes, sessionId })
      }
    },
    [isConnected, eventId]
  )

  // Bulk unlock — sends all seats to unlock in ONE message
  const unlockSeats = useCallback(
    (seatCodes: string[], sessionId?: string) => {
      if (socketRef.current && isConnected && eventId && seatCodes.length > 0) {
        socketRef.current.emit('unlock_seats', { eventId, seatCodes, sessionId })
      }
    },
    [isConnected, eventId]
  )

  const markSeatSold = useCallback(
    (seatCode: string) => {
      if (socketRef.current && isConnected && eventId) {
        socketRef.current.emit('seat_sold', { eventId, seatCode })
      }
    },
    [isConnected, eventId]
  )

  const requestStatus = useCallback(() => {
    if (socketRef.current && isConnected && eventId) {
      socketRef.current.emit('request_status', { eventId })
    }
  }, [isConnected, eventId])

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
  }, [])

  // ---- Event handlers (setter) ----

  const onSeatLocked = useCallback((handler: (payload: SeatLockedPayload) => void) => {
    onSeatLockedRef.current = handler
  }, [])

  const onSeatUnlocked = useCallback((handler: (payload: SeatUnlockedPayload) => void) => {
    onSeatUnlockedRef.current = handler
  }, [])

  const onSeatSold = useCallback((handler: (payload: SeatSoldPayload) => void) => {
    onSeatSoldRef.current = handler
  }, [])

  const onAllSeatsStatus = useCallback((handler: (payload: AllSeatsStatusPayload) => void) => {
    onAllSeatsStatusRef.current = handler
  }, [])

  const onSeatLockRejected = useCallback((handler: (payload: SeatLockRejectedPayload) => void) => {
    onSeatLockRejectedRef.current = handler
  }, [])

  const onSeatUnlockRejected = useCallback((handler: (payload: SeatUnlockRejectedPayload) => void) => {
    onSeatUnlockRejectedRef.current = handler
  }, [])

  const onSeatsLockRejected = useCallback((handler: (payload: SeatsLockRejectedPayload) => void) => {
    onSeatsLockRejectedRef.current = handler
  }, [])

  return {
    isConnected,
    userCount,

    // Event handlers - call these to register callbacks
    onSeatLocked,
    onSeatUnlocked,
    onSeatSold,
    onAllSeatsStatus,
    onSeatLockRejected,
    onSeatUnlockRejected,
    onSeatsLockRejected,

    // Actions
    lockSeat,
    unlockSeat,
    lockSeats,
    unlockSeats,
    markSeatSold,
    requestStatus,
    disconnect,
  }
}
