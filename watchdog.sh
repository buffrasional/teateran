#!/bin/bash
while true; do
  sleep 15
  if ! curl -s -o /dev/null --max-time 5 http://localhost:3000/ 2>/dev/null; then
    echo "[$(date)] Server down" >> /tmp/watchdog.log
    pkill -9 -f "next dev" 2>/dev/null
    sleep 3
    cd /home/z/my-project
    rm -rf .next 2>/dev/null
    export DATABASE_URL=$(grep '^DATABASE_URL=' .env | cut -d'=' -f2-)
    export NODE_OPTIONS="--max-old-space-size=4096"
    setsid bash /home/z/my-project/start-server.sh &
    echo "[$(date)] Restarted" >> /tmp/watchdog.log
  fi
done
