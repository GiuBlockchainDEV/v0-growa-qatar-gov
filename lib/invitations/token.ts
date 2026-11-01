import { createHash, randomBytes } from 'crypto'

const TOKEN_BYTES = 32

export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  return { token, tokenHash: hashInvitationToken(token) }
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function invitationExpiresAt(days = 7): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export function isInvitationExpired(expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return true
  return Date.parse(expiresAt) <= now
}
