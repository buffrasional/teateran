#!/bin/bash
# Kill anything on port 3000 first
fuser -k 3000/tcp 2>/dev/null
sleep 1

cd /home/z/my-project
export $(grep -v '^#' .env | xargs)
DATABASE_URL=$(grep DATABASE_URL .env | cut -d'=' -f2-)
exec npx next start -p 3000
