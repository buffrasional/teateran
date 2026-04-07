#!/bin/bash
# Warmup script — pre-compiles all API routes to prevent HMR crash during user flow

echo "[warmup] Starting route pre-compilation..."

# Wait for server to be ready
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
    break
  fi
  sleep 1
done

sleep 2

echo "[warmup] Server ready, pre-compiling routes..."

# GET routes
curl -s -o /dev/null http://localhost:3000/
curl -s -o /dev/null http://localhost:3000/api/events
curl -s -o /dev/null http://localhost:3000/events/cmngarb270002nkhbwbrtq7mn
curl -s -o /dev/null http://localhost:3000/verify

# POST routes — trigger compilation with minimal payloads
curl -s -o /dev/null -X POST http://localhost:3000/api/seats/lock -H "Content-Type: application/json" -d '{"eventId":"_","seatCodes":[]}'
curl -s -o /dev/null -X POST http://localhost:3000/api/seats/unlock -H "Content-Type: application/json" -d '{"eventId":"_","seatCodes":[]}'
curl -s -o /dev/null -X POST http://localhost:3000/api/checkout -H "Content-Type: application/json" -d '{}'
curl -s -o /dev/null -X POST http://localhost:3000/api/webhooks/midtrans -H "Content-Type: application/json" -d '{}'
curl -s -o /dev/null -X POST http://localhost:3000/api/snap-token -H "Content-Type: application/json" -d '{}'

# Admin routes
curl -s -o /dev/null http://localhost:3000/admin
curl -s -o /dev/null http://localhost:3000/api/admin/events

echo "[warmup] All routes pre-compiled. Ready for traffic."
