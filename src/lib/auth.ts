import crypto from 'crypto'

const APP_SECRET = process.env.APP_SECRET || 'teateran-secret-key'

// Hash password with SHA-256 + salt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .createHmac('sha256', APP_SECRET)
    .update(password + salt)
    .digest('hex')
  return `${salt}:${hash}`
}

// Verify password
export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':')
  if (!salt || !hash) return false
  const verifyHash = crypto
    .createHmac('sha256', APP_SECRET)
    .update(password + salt)
    .digest('hex')
  return hash === verifyHash
}

// Generate session token
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Simple token validation (in production, use proper JWT or session store)
export function createSessionToken(username: string): string {
  const payload = JSON.stringify({
    username,
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    iat: Date.now(),
  })
  const encoded = Buffer.from(payload).toString('base64url')
  const signature = crypto
    .createHmac('sha256', APP_SECRET)
    .update(encoded)
    .digest('hex')
  return `${encoded}.${signature}`
}

export function validateSessionToken(token: string): { valid: boolean; username?: string } {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return { valid: false }

    const expectedSig = crypto
      .createHmac('sha256', APP_SECRET)
      .update(encoded)
      .digest('hex')

    if (signature !== expectedSig) return { valid: false }

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (payload.exp < Date.now()) return { valid: false }

    return { valid: true, username: payload.username }
  } catch {
    return { valid: false }
  }
}
