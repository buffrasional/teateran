# --- Stage 1: Build Next.js ---
FROM node:20-slim AS builder
WORKDIR /app

# Install openssl and other build deps
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# We need to ensure Prisma client is generated before build
RUN npx prisma generate
RUN npm run build

# --- Stage 2: Final Image ---
FROM node:20-slim
WORKDIR /app

# Install necessary libraries for Prisma and networking
RUN apt-get update && apt-get install -y openssl ca-certificates curl bash unzip && rm -rf /var/lib/apt/lists/*

# Install Bun for Seat Service
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install Caddy (Debian/Ubuntu method)
RUN apt-get update && apt-get install -y debian-keyring debian-archive-keyring apt-transport-https \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list \
    && apt-get update && apt-get install -y caddy \
    && rm -rf /var/lib/apt/lists/*

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy Next.js standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Mini Services (Seat Service)
COPY mini-services ./mini-services
RUN cd mini-services/seat-service && bun install

# Copy Configs and Scripts
COPY Caddyfile ./Caddyfile
COPY scripts/start-all.sh ./scripts/start-all.sh
RUN chmod +x ./scripts/start-all.sh

# Expose the Railway port
EXPOSE 3000

# Start everything
CMD ["./scripts/start-all.sh"]
