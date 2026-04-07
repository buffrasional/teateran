#!/bin/bash

# Ensure we are in /app
cd /app

echo "Starting deployment checks..."

# Ensure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set."
fi

# 1. Start Seat Service on port 3003
echo "Starting Seat Service (Bun) at /app/mini-services/seat-service..."
# Use absolute path to bun and script
cd /app/mini-services/seat-service && /root/.bun/bin/bun run index.ts > /app/seat-service.log 2>&1 &

# 2. Start Next.js on port 3001
echo "Starting Next.js Server at /app/server.js on port 3001..."
# Standalone Next.js needs HOSTNAME=0.0.0.0
HOSTNAME="0.0.0.0" PORT=3001 node /app/server.js &

# 3. Wait for Next.js to be ready (Health check)
echo "Waiting for Next.js on localhost:3001..."
for i in {1..15}; do
    if curl -s localhost:3001 > /dev/null; then
        echo "Next.js is UP."
        break
    fi
    sleep 2
    echo "Still waiting for Next.js ($i/15)..."
done

# 4. Start Caddy to route traffic from Railway's $PORT to internal 3001/3003
echo "Starting Caddy Proxy on port ${PORT:-3000} using /app/Caddyfile..."
/usr/bin/caddy run --config /app/Caddyfile --adapter caddyfile

# Wait for all background processes
wait -n
exit $?
