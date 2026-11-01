export type AccountStatus = 'invited' | 'active' | 'suspended' | 'deactivated'

const BLOCKED: ReadonlySet<AccountStatus> = new Set(['suspended', 'deactivated'])

export function normalizeAccountStatus(value: string | null | undefined): AccountStatus {
  const s = (value ?? 'active').toLowerCase()
  if (s === 'invited' || s === 'active' || s === 'suspended' || s === 'deactivated') {
    return s
  }
  return 'active'
}

export function isAccountLoginAllowed(status: string | null | undefined): boolean {
  return !BLOCKED.has(normalizeAccountStatus(status))
}

export function accountStatusBlocksSession(status: string | null | undefined): boolean {
  return BLOCKED.has(normalizeAccountStatus(status))
}
