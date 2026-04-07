#!/bin/bash
# ═══════════════════════════════════════════════
# ensure-env.sh — Regenerate .env from .credentials
# Run: bash /home/z/my-project/ensure-env.sh
# ═══════════════════════════════════════════════

CRED="/home/z/my-project/.credentials"
ENV="/home/z/my-project/.env"
STANDALONE_ENV="/home/z/my-project/.next/standalone/.env"

if [ ! -f "$CRED" ]; then
  echo "ERROR: $CRED not found!"
  exit 1
fi

# Read values from credentials
MERCHANT_ID=$(rg '^MIDTRANS_MERCHANT_ID=' "$CRED" | cut -d= -f2-)
CLIENT_KEY=$(rg '^MIDTRANS_CLIENT_KEY=' "$CRED" | cut -d= -f2-)
SERVER_KEY=$(rg '^MIDTRANS_SERVER_KEY=' "$CRED" | cut -d= -f2-)
EMAIL_USER=$(rg '^EMAIL_USER=' "$CRED" | cut -d= -f2-)
EMAIL_PASS=$(rg '^EMAIL_PASS=' "$CRED" | cut -d= -f2-)
APP_SECRET=$(rg '^APP_SECRET=' "$CRED" | cut -d= -f2-)
DB_URL=$(rg '^SUPABASE_POOLER_URL=' "$CRED" | cut -d= -f2-)

# Write .env
cat > "$ENV" << ENVEOF
DATABASE_URL=${DB_URL}
APP_SECRET=${APP_SECRET}
MIDTRANS_SERVER_KEY=${SERVER_KEY}
MIDTRANS_CLIENT_KEY=${CLIENT_KEY}
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=${CLIENT_KEY}
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_APP_URL=https://preview-chat-3320097f-4523-4c3e-9e9e-a56b3f478eca.space.z.ai
EMAIL_USER=${EMAIL_USER}
EMAIL_PASS=${EMAIL_PASS}
ENVEOF

echo "✅ .env regenerated from .credentials"

# Also write to standalone if it exists
if [ -d "/home/z/my-project/.next/standalone" ]; then
  cat > "$STANDALONE_ENV" << ENVEOF
DATABASE_URL=${DB_URL}
APP_SECRET=${APP_SECRET}
MIDTRANS_SERVER_KEY=${SERVER_KEY}
MIDTRANS_CLIENT_KEY=${CLIENT_KEY}
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=${CLIENT_KEY}
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_APP_URL=https://preview-chat-3320097f-4523-4c3e-9e9e-a56b3f478eca.space.z.ai
EMAIL_USER=${EMAIL_USER}
EMAIL_PASS=${EMAIL_PASS}
ENVEOF
  echo "✅ standalone .env also updated"
fi
