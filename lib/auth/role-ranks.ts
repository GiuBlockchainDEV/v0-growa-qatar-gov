/**
 * Membership role authority ranks (higher = more privilege within an organization).
 * Keep in sync with `membership_role_rank()` in supabase migrations.
 */
export const MEMBERSHIP_ROLE_RANK: Record<string, number> = {
  owner: 1000,
  super_admin: 900,
  ministry_super_admin: 850,
  ministry_admin: 800,
  hassad_admin: 750,
  qdb_admin: 750,
  farm_company_admin: 700,
  admin: 600,
  ministry_officer: 500,
  sourcing_manager: 450,
  supply_chain_officer: 450,
  finance_officer: 450,
  credit_analyst: 450,
  farm_manager: 400,
  agronomist: 400,
  technical_support: 350,
  editor: 250,
  operator: 250,
  member: 100,
  viewer: 50,
}

export const ORG_OWNER_ROLES = new Set(['owner', 'super_admin'])

export function membershipRoleRank(role: string | null | undefined): number {
  if (!role) return 0
  return MEMBERSHIP_ROLE_RANK[role] ?? 0
}

export function isOrgOwnerRole(role: string | null | undefined): boolean {
  return Boolean(role && ORG_OWNER_ROLES.has(role))
}

export const SELF_SERVICE_ORGANIZATION_TYPES = new Set([
  'private',
  'public',
  'farm_company',
])

export const PRIVILEGED_ORGANIZATION_TYPES = new Set(['government', 'government_master'])
