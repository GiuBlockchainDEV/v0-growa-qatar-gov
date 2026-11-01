import type { PermissionKey } from '@/lib/auth/capabilities'
import type { ProductNavItem } from '@/lib/navigation/registry'

/** Nav keys gated by server-side capability (My Profile is always shown). */
export const NAV_PERMISSION_REQUIREMENTS: Partial<Record<string, PermissionKey>> = {
  'users-roles': 'users.view',
  invitations: 'users.invite',
  organizations: 'organizations.view',
  'access-permissions': 'users.view',
  'security-audit': 'audit.view',
}

export function filterNavByPermissions(
  items: ProductNavItem[],
  hasPermission: (key: PermissionKey) => boolean,
  options?: { isPlatformStaff?: boolean }
): ProductNavItem[] {
  return items.filter((item) => {
    if (item.key === 'my-profile') return true
    const required = NAV_PERMISSION_REQUIREMENTS[item.key]
    if (!required) return true
    if (options?.isPlatformStaff && item.key === 'organizations') {
      return hasPermission('platform.organizations.provision') || hasPermission('organizations.view')
    }
    return hasPermission(required)
  })
}
