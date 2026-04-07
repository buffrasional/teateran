#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js..." >> /home/z/my-project/server.log
  NODE_ENV=production node node_modules/.bin/next start -p 3000 -H 0.0.0.0 >> /home/z/my-project/server.log 2>&1
  EC=$?
  echo "[$(date)] Server exited (code=$EC), restarting in 2s..." >> /home/z/my-project/server.log
  sleep 2
done
