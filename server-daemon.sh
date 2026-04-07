#!/bin/bash
# Daemon wrapper for Next.js server
# Runs in a loop, auto-restarts on crash

cd /home/z/my-project
export $(grep -v '^#' .env | xargs)
DATABASE_URL=$(grep DATABASE_URL .env | cut -d'=' -f2-)

while true; do
  echo "$(date) - Starting Next.js server..." >> /tmp/next-daemon.log
  npx next start -p 3000 >> /tmp/next-daemon.log 2>&1
  echo "$(date) - Server exited, restarting in 2s..." >> /tmp/next-daemon.log
  sleep 2
done
