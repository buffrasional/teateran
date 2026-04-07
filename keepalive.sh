#!/bin/bash
# Keepalive — starts Next.js, monitors via PID file, auto-restarts
# FIXED: use pidfile + timeout instead of `wait` (which hangs on segfault)

cd /home/z/my-project
PIDFILE="/tmp/next-server.pid"

# Read DATABASE_URL from .env to override system env
export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d'=' -f2-)
export NODE_OPTIONS="--max-old-space-size=4096"

echo "[$(date)] DATABASE_URL: ${DATABASE_URL:0:40}..."

while true; do
  rm -rf .next 2>/dev/null
  pkill -f "next" 2>/dev/null
  sleep 2
  
  echo "[$(date)] Starting server..."
  
  # Start server & save PID
  npx next dev -p 3000 > /tmp/next-out.log 2> /tmp/next-err.log &
  SERVER_PID=$!
  echo "$SERVER_PID" > "$PIDFILE"
  
  # Wait for "Ready" (max 60s)
  READY=0
  for i in $(seq 1 60); do
    if ! kill -0 $SERVER_PID 2>/dev/null; then
      echo "[$(date)] Server crashed during startup"
      break
    fi
    if grep -q "Ready" /tmp/next-out.log 2>/dev/null; then
      echo "[$(date)] Server ready (PID: $SERVER_PID)"
      READY=1
      break
    fi
    sleep 1
  done
  
  if [ $READY -eq 0 ]; then
    echo "[$(date)] Server never became ready. Retrying in 5s..."
    sleep 5
    continue
  fi
  
  # Monitor: check if PID is alive every 2 seconds
  echo "[$(date)] Monitoring server..."
  while true; do
    sleep 2
    if ! kill -0 $SERVER_PID 2>/dev/null; then
      echo "[$(date)] Server process died! Restarting in 3s..."
      sleep 3
      break
    fi
  done
  
  # Clean up PID file
  rm -f "$PIDFILE"
done
