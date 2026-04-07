#!/bin/bash
while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ':3003 '; then
    echo "[$(date)] seat-service down, restarting..." >> /tmp/seat-service-watchdog.log
    cd /home/z/my-project/mini-services/seat-service
    node server.js >> /tmp/seat-service.log 2>&1 &
    sleep 3
    if ss -tlnp 2>/dev/null | grep -q ':3003 '; then
      echo "[$(date)] seat-service restarted OK" >> /tmp/seat-service-watchdog.log
    else
      echo "[$(date)] seat-service failed to start!" >> /tmp/seat-service-watchdog.log
    fi
  fi
  sleep 8
done
