# --- Stage 1: Build Next.js ---
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Stage 2: Final Image ---
FROM node:20-slim
WORKDIR /app

# Install necessary runtime libraries
RUN apt-get update && apt-get install -y openssl ca-certificates curl bash procps unzip && rm -rf /var/lib/apt/lists/*

# Install Bun for Seat Service
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install Caddy
RUN apt-get update && apt-get install -y debian-keyring debian-archive-keyring apt-transport-https \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list \
    && apt-get update && apt-get install -y caddy \
    && rm -rf /var/lib/apt/lists/*

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# --- Next.js Standalone Structure ---
# COPY --from=builder /app/.next/standalone ./
# Standard standalone build includes everything in its own folder.
# We copy it to /app.
COPY --from=builder /app/.next/standalone /app/
COPY --from=builder /app/.next/static /app/.next/static
COPY --from=builder /app/public /app/public

# Copy Mini Services (Seat Service)
COPY mini-services /app/mini-services
RUN cd /app/mini-services/seat-service && bun install

# Copy Configs and Scripts
COPY Caddyfile /app/Caddyfile
COPY scripts/start-all.sh /app/scripts/start-all.sh
RUN chmod +x /app/scripts/start-all.sh

# Expose the Railway port
EXPOSE 3000

# Start everything with absolute path
CMD ["/bin/bash", "/app/scripts/start-all.sh"]
