#!/bin/bash
# Auto-restart: if Next.js is down, clean restart
if ! curl -s -o /dev/null --max-time 5 http://localhost:3000/ 2>/dev/null; then
  echo "[$(date)] Server down, restarting..." >> /tmp/auto-restart.log
  pkill -f "next" 2>/dev/null
  sleep 2
  cd /home/z/my-project
  rm -rf .next 2>/dev/null
  export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d'=' -f2-)
  export NODE_OPTIONS="--max-old-space-size=4096"
  nohup npx next dev -p 3000 > /tmp/next-out.log 2> /tmp/next-err.log &
  echo "[$(date)] Restarted with PID $!" >> /tmp/auto-restart.log
fi
