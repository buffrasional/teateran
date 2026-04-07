#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js dev server..." >> /home/z/my-project/server.log
  npx next dev -p 3000 2>&1 | tee -a /home/z/my-project/server.log
  echo "[$(date)] Server exited, restarting in 3s..." >> /home/z/my-project/server.log
  sleep 3
done
