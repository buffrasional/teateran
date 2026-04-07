const { Server } = require('socket.io');

const io = new Server({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Track rooms and their users
const roomUsers = new Map();
// Track seat locks by event room
const seatLocks = new Map();

function getRoomSize(roomId) {
  return roomUsers.get(roomId)?.size || 0;
}

function broadcastUserCount(roomId) {
  io.to(roomId).emit('user_count', { eventId: roomId, count: getRoomSize(roomId) });
}

function cleanupStaleLocks(eventId) {
  const locks = seatLocks.get(eventId);
  if (!locks) return;

  const now = Date.now();
  const staleCodes = [];

  for (const [seatCode, lock] of locks) {
    if (lock.lockedUntil < now) {
      staleCodes.push(seatCode);
    }
  }

  for (const seatCode of staleCodes) {
    locks.delete(seatCode);
    io.to(eventId).emit('seat_unlocked', {
      eventId,
      seatCode,
      unlockedBy: 'system',
      reason: 'lock_expired',
    });
  }
}

function getLockState(eventId) {
  const locks = seatLocks.get(eventId);
  if (!locks) return [];
  cleanupStaleLocks(eventId);
  return Array.from(locks.entries()).map(([seatCode, lock]) => ({
    seatCode,
    status: lock.lockedUntil > Date.now() ? 'LOCKED_TEMPORARY' : 'AVAILABLE',
    sessionId: lock.sessionId,
    lockedUntil: lock.lockedUntil,
  }));
}

function sendLockState(socket, eventId) {
  const seats = getLockState(eventId);
  if (seats.length > 0) {
    socket.emit('all_seats_status', { eventId, seats });
  }
}

io.on('connection', (socket) => {
  console.log(`[seat-service] Client connected: ${socket.id}`);

  socket.on('join_event', ({ eventId }) => {
    socket.join(eventId);

    if (!roomUsers.has(eventId)) {
      roomUsers.set(eventId, new Set());
    }
    roomUsers.get(eventId).add(socket.id);

    console.log(`[seat-service] ${socket.id} joined event ${eventId} (total: ${getRoomSize(eventId)})`);
    broadcastUserCount(eventId);

    // Cleanup stale locks
    cleanupStaleLocks(eventId);

    // Send current lock state to newly joined client
    sendLockState(socket, eventId);
  });

  // Individual lock
  socket.on('lock_seat', ({ eventId, seatCode, sessionId }) => {
    if (!seatLocks.has(eventId)) {
      seatLocks.set(eventId, new Map());
    }
    const locks = seatLocks.get(eventId);

    const existingLock = locks.get(seatCode);
    if (existingLock && existingLock.sessionId !== sessionId && existingLock.lockedUntil > Date.now()) {
      socket.emit('seat_lock_rejected', {
        eventId,
        seatCode,
        reason: 'already_locked',
        existingSessionId: existingLock.sessionId,
      });
      return;
    }

    const lockedUntil = Date.now() + 10 * 60 * 1000;
    locks.set(seatCode, { sessionId, lockedUntil });

    io.to(eventId).emit('seat_locked', {
      eventId,
      seatCode,
      sessionId,
      lockedAt: Date.now(),
      lockedUntil,
    });

    console.log(`[seat-service] Seat ${seatCode} locked by ${sessionId}`);
  });

  // Bulk lock
  socket.on('lock_seats', ({ eventId, seatCodes, sessionId }) => {
    if (!seatLocks.has(eventId)) {
      seatLocks.set(eventId, new Map());
    }
    const locks = seatLocks.get(eventId);

    const lockedSeats = [];
    const rejectedSeats = [];

    for (const seatCode of seatCodes) {
      const existingLock = locks.get(seatCode);
      if (existingLock && existingLock.sessionId !== sessionId && existingLock.lockedUntil > Date.now()) {
        rejectedSeats.push({ seatCode, reason: 'already_locked' });
        continue;
      }

      const lockedUntil = Date.now() + 10 * 60 * 1000;
      locks.set(seatCode, { sessionId, lockedUntil });
      lockedSeats.push(seatCode);

      io.to(eventId).emit('seat_locked', {
        eventId,
        seatCode,
        sessionId,
        lockedAt: Date.now(),
        lockedUntil,
      });
    }

    console.log(`[seat-service] Bulk lock: ${lockedSeats.join(', ')} (rejected: ${rejectedSeats.map(r => r.seatCode).join(', ')})`);

    if (rejectedSeats.length > 0) {
      socket.emit('seats_lock_rejected', { eventId, rejectedSeats });
    }
  });

  // Individual unlock
  socket.on('unlock_seat', ({ eventId, seatCode, sessionId }) => {
    const locks = seatLocks.get(eventId);
    if (!locks) return;

    const existingLock = locks.get(seatCode);
    if (existingLock) {
      if (sessionId && existingLock.sessionId !== sessionId) {
        socket.emit('seat_unlock_rejected', {
          eventId,
          seatCode,
          reason: 'not_your_lock',
        });
        return;
      }
      locks.delete(seatCode);
    }

    io.to(eventId).emit('seat_unlocked', {
      eventId,
      seatCode,
      unlockedBy: sessionId || 'system',
    });

    console.log(`[seat-service] Seat ${seatCode} unlocked`);
  });

  // Bulk unlock
  socket.on('unlock_seats', ({ eventId, seatCodes, sessionId }) => {
    const locks = seatLocks.get(eventId);
    if (!locks) return;

    for (const seatCode of seatCodes) {
      const existingLock = locks.get(seatCode);
      if (existingLock) {
        if (sessionId && existingLock.sessionId !== sessionId) {
          continue;
        }
        locks.delete(seatCode);
      }

      io.to(eventId).emit('seat_unlocked', {
        eventId,
        seatCode,
        unlockedBy: sessionId || 'system',
      });
    }

    console.log(`[seat-service] Bulk unlock: ${seatCodes.join(', ')}`);
  });

  socket.on('seat_sold', ({ eventId, seatCode }) => {
    const locks = seatLocks.get(eventId);
    if (locks) {
      locks.delete(seatCode);
    }

    io.to(eventId).emit('seat_sold', {
      eventId,
      seatCode,
      soldAt: Date.now(),
    });

    console.log(`[seat-service] Seat ${seatCode} sold`);
  });

  socket.on('request_status', ({ eventId }) => {
    sendLockState(socket, eventId);
  });

  socket.on('disconnect', () => {
    console.log(`[seat-service] Client disconnected: ${socket.id}`);

    for (const [eventId, users] of roomUsers) {
      if (users.delete(socket.id)) {
        broadcastUserCount(eventId);
      }
    }
  });
});

// Periodic cleanup every 30 seconds
setInterval(() => {
  for (const eventId of seatLocks.keys()) {
    cleanupStaleLocks(eventId);
  }
}, 30000);

const PORT = 3003;
io.listen(PORT);
console.log(`[seat-service] WebSocket server running on port ${PORT}`);
