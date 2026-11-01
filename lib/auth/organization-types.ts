import type { OrganizationType } from '@/app/dashboard/settings/settings-model'
import { ORGANIZATION_TYPE_OPTIONS } from '@/app/dashboard/settings/settings-model'

export function organizationTypesForCreator(isPlatformAdmin: boolean): Array<{
  value: OrganizationType
  label: string
}> {
  if (isPlatformAdmin) return ORGANIZATION_TYPE_OPTIONS
  return ORGANIZATION_TYPE_OPTIONS.filter(
    (option) => option.value !== 'government' && option.value !== 'government_master'
  )
}
