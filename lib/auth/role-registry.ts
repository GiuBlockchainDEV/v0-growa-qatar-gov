import type { PermissionKey } from '@/lib/auth/capabilities'
import { permissionSet } from '@/lib/auth/capabilities'

/** Canonical organizational roles (stored in user_organization_members.role). */
export type CanonicalOrgRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'viewer'
  | 'editor'
  | 'operator'
  | 'super_admin'
  | 'ministry_officer'
  | 'ministry_admin'
  | 'ministry_super_admin'
  | 'ministry_inspector'
  | 'sourcing_manager'
  | 'supply_chain_officer'
  | 'hassad_admin'
  | 'finance_officer'
  | 'credit_analyst'
  | 'qdb_admin'
  | 'farm_manager'
  | 'agronomist'
  | 'farm_company_admin'
  | 'technical_support'
  | 'analyst'

/**
 * Legacy aliases map to an equal or lower canonical role — never escalate privilege.
 */
export const ROLE_ALIASES: Record<string, CanonicalOrgRole> = {
  super_admin: 'super_admin',
  admin: 'admin',
  ministry_super_admin: 'ministry_super_admin',
  ministry_admin: 'ministry_admin',
  ministry_officer: 'ministry_officer',
  ministry_inspector: 'ministry_inspector',
  inspector: 'ministry_inspector',
  hassad_admin: 'hassad_admin',
  supply_chain_officer: 'sourcing_manager',
  sourcing_manager: 'sourcing_manager',
  qdb_admin: 'qdb_admin',
  credit_analyst: 'credit_analyst',
  finance_officer: 'finance_officer',
  farm_company_admin: 'farm_company_admin',
  farm_manager: 'farm_manager',
  agronomist: 'agronomist',
  analyst: 'analyst',
  editor: 'editor',
  operator: 'operator',
  viewer: 'viewer',
  member: 'member',
  owner: 'owner',
  technical_support: 'technical_support',
}

const BASE_VIEW: PermissionKey[] = ['organizations.view', 'farms.view', 'intelligence.view']

const ROLE_PERMISSIONS: Record<CanonicalOrgRole, PermissionKey[]> = {
  viewer: [...BASE_VIEW],
  member: [...BASE_VIEW, 'supply.view'],
  operator: [...BASE_VIEW, 'supply.view', 'farms.edit', 'decisions.propose'],
  editor: [...BASE_VIEW, 'supply.view', 'farms.edit', 'decisions.propose'],
  analyst: [...BASE_VIEW, 'supply.view', 'intelligence.view', 'decisions.propose'],
  agronomist: [...BASE_VIEW, 'farms.edit', 'intelligence.view', 'decisions.propose'],
  farm_manager: [...BASE_VIEW, 'farms.edit', 'supply.view', 'decisions.propose', 'decisions.execute'],
  technical_support: [...BASE_VIEW, 'farms.view'],
  ministry_officer: [...BASE_VIEW, 'supply.view', 'intelligence.view', 'decisions.propose'],
  ministry_inspector: [...BASE_VIEW, 'farms.view', 'intelligence.view', 'decisions.propose'],
  ministry_admin: [
    ...BASE_VIEW,
    'users.view',
    'users.invite',
    'users.manage',
    'roles.assign',
    'farms.edit',
    'supply.view',
    'supply.edit',
    'intelligence.view',
    'data_sharing.manage',
    'decisions.propose',
    'decisions.approve',
    'audit.view',
  ],
  ministry_super_admin: [
    ...BASE_VIEW,
    'users.view',
    'users.invite',
    'users.manage',
    'roles.assign',
    'organizations.manage',
    'farms.edit',
    'supply.view',
    'supply.edit',
    'intelligence.view',
    'data_sharing.manage',
    'decisions.propose',
    'decisions.approve',
    'decisions.execute',
    'audit.view',
  ],
  sourcing_manager: [...BASE_VIEW, 'supply.view', 'supply.edit', 'decisions.propose'],
  supply_chain_officer: [...BASE_VIEW, 'supply.view', 'decisions.propose'],
  hassad_admin: [
    ...BASE_VIEW,
    'users.view',
    'users.invite',
    'users.manage',
    'roles.assign',
    'supply.view',
    'supply.edit',
    'decisions.propose',
    'decisions.approve',
  ],
  finance_officer: [...BASE_VIEW, 'supply.view', 'intelligence.view', 'decisions.propose'],
  credit_analyst: [...BASE_VIEW, 'supply.view', 'intelligence.view'],
  qdb_admin: [
    ...BASE_VIEW,
    'users.view',
    'users.manage',
    'supply.view',
    'decisions.propose',
    'decisions.approve',
  ],
  farm_company_admin: [
    ...BASE_VIEW,
    'users.view',
    'users.invite',
    'users.manage',
    'roles.assign',
    'farms.edit',
    'supply.view',
    'decisions.propose',
    'decisions.execute',
  ],
  admin: [
    ...BASE_VIEW,
    'users.view',
    'users.invite',
    'users.manage',
    'roles.assign',
    'farms.edit',
    'supply.view',
    'decisions.propose',
    'data_sharing.manage',
  ],
  owner: [
    ...BASE_VIEW,
    'users.view',
    'users.invite',
    'users.manage',
    'roles.assign',
    'organizations.manage',
    'farms.edit',
    'supply.view',
    'supply.edit',
    'data_sharing.manage',
    'decisions.propose',
    'decisions.execute',
    'audit.view',
  ],
  super_admin: [
    ...BASE_VIEW,
    'users.view',
    'users.invite',
    'users.manage',
    'roles.assign',
    'organizations.manage',
    'farms.edit',
    'supply.view',
    'supply.edit',
    'intelligence.view',
    'data_sharing.manage',
    'decisions.propose',
    'decisions.approve',
    'decisions.execute',
    'audit.view',
  ],
}

export type PlatformStaffTier = 'super_admin' | 'support'

const PLATFORM_SUPER_ADMIN: PermissionKey[] = [
  'platform.config.manage',
  'platform.organizations.provision',
  'platform.staff.manage',
  'audit.view',
  'organizations.view',
  'users.view',
]

const PLATFORM_SUPPORT: PermissionKey[] = [
  'platform.support.tools',
  'users.view',
  'organizations.view',
]

export function normalizeOrgRole(raw: string | null | undefined): CanonicalOrgRole {
  if (!raw) return 'viewer'
  const key = raw.trim().toLowerCase()
  return ROLE_ALIASES[key] ?? (key in ROLE_PERMISSIONS ? (key as CanonicalOrgRole) : 'viewer')
}

export function permissionsForOrgRole(rawRole: string | null | undefined) {
  const role = normalizeOrgRole(rawRole)
  return permissionSet(ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.viewer)
}

export function permissionsForPlatformStaff(tier: PlatformStaffTier | null | undefined) {
  if (tier === 'super_admin') return permissionSet(PLATFORM_SUPER_ADMIN)
  if (tier === 'support') return permissionSet(PLATFORM_SUPPORT)
  return permissionSet([])
}

export function mergePermissionSets(...sets: ReadonlySet<PermissionKey>[]) {
  const merged = new Set<PermissionKey>()
  for (const set of sets) {
    for (const key of set) merged.add(key)
  }
  return merged as ReadonlySet<PermissionKey>
}

export function roleDisplayName(role: string): string {
  return normalizeOrgRole(role).replace(/_/g, ' ')
}
