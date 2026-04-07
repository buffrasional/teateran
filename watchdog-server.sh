#!/bin/bash
# Keep Next.js alive — if it dies, restart it
cd /home/z/my-project
export DATABASE_URL="postgresql://postgres.lpdujkpjkcpyiptzyeml:G5PdN_edtw%24%21ddk@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

while true; do
  # Check if server is running
  if ! pgrep -f "next start" > /dev/null 2>&1; then
    echo "[$(date)] Server dead. Restarting..." >> /home/z/my-project/watchdog.log
    NODE_ENV=production nohup npx next start -p 3000 >> /home/z/my-project/server.log 2>&1 &
    sleep 5
    # Verify it's actually running
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
      echo "[$(date)] Server restarted OK" >> /home/z/my-project/watchdog.log
    else
      echo "[$(date)] Server restart FAILED" >> /home/z/my-project/watchdog.log
    fi
  fi
  sleep 10
done
