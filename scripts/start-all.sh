#!/bin/bash

# Ensure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set. Next.js will likely crash."
    # We continue but warn, to let Next.js show its own error if possible
fi

# 1. Start Seat Service on port 3003
echo "Starting Seat Service (Bun)..."
cd mini-services/seat-service && bun run index.ts > ../../seat-service.log 2>&1 &
cd ../..

# 2. Start Next.js on port 3001
echo "Starting Next.js Server on port 3001..."
# Redirect logs to stderr/stdout so they appear in Railway console
PORT=3001 node server.js &

# 3. Wait for Next.js to be ready (Health check)
echo "Waiting for Next.js to accept connections..."
MAX_RETRIES=10
COUNT=0
while ! curl -s localhost:3001 > /dev/null; do
    sleep 2
    COUNT=$((COUNT+1))
    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo "WARNING: Next.js is taking longer than expected to start."
        break
    fi
done

# 4. Start Caddy to route traffic from $PORT to 3001/3003
echo "Starting Caddy Proxy on port ${PORT:-3000}..."
caddy run --config ./Caddyfile --adapter caddyfile

# Wait for all background processes
wait -n
exit $?
