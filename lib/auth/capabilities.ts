/**
 * Canonical capability keys for NFII authorization.
 * Server-side checks must use these keys; UI may mirror for UX only.
 */
export const PERMISSION_KEYS = [
  'users.view',
  'users.invite',
  'users.manage',
  'roles.assign',
  'organizations.view',
  'organizations.manage',
  'farms.view',
  'farms.edit',
  'supply.view',
  'supply.edit',
  'intelligence.view',
  'data_sharing.manage',
  'decisions.propose',
  'decisions.approve',
  'decisions.execute',
  'audit.view',
  'platform.config.manage',
  'platform.organizations.provision',
  'platform.staff.manage',
  'platform.support.tools',
] as const

export type PermissionKey = (typeof PERMISSION_KEYS)[number]

export type PermissionSet = ReadonlySet<PermissionKey>

export function permissionSet(keys: PermissionKey[]): PermissionSet {
  return new Set(keys)
}

export function hasPermission(set: PermissionSet, key: PermissionKey): boolean {
  return set.has(key)
}
