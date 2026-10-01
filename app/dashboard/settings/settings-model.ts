/* Constants and types shared by the Settings hook and tabs. */

export const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
] as const

export type AssignableRole = (typeof ROLE_OPTIONS)[number]['value']
export type OrganizationType = 'government_master' | 'government' | 'farm_company' | 'public' | 'private'

export const ORGANIZATION_TYPE_OPTIONS: Array<{ value: OrganizationType; label: string }> = [
  { value: 'private', label: 'Private' },
  { value: 'public', label: 'Public' },
  { value: 'farm_company', label: 'Farm company' },
  { value: 'government', label: 'Government' },
  { value: 'government_master', label: 'Government master' },
]

export const SETTINGS_TABS = ['profile', 'preferences', 'organization'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]
