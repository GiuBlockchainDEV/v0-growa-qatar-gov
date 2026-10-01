import { describe, expect, it } from 'vitest'
import { getModuleStatus } from '@/lib/navigation/module-status'
import {
  PRODUCT_AREAS,
  ROLE_NAV_KEYS,
  allNavItems,
  buildNavigation,
  getNavItem,
  isHarvestModuleKey,
  ministryProfileForRole,
  navItemLabel,
  resolvePlatformRoleProfile,
  type PlatformRoleProfile,
} from '@/lib/navigation/registry'

const PROFILES = Object.keys(ROLE_NAV_KEYS) as PlatformRoleProfile[]

describe('navigation registry', () => {
  it('has unique keys, a known area and an Arabic label for every item', () => {
    const items = allNavItems()
    const keys = items.map((item) => item.key)
    expect(new Set(keys).size).toBe(keys.length)
    const areaIds = new Set(PRODUCT_AREAS.map((area) => area.id))
    for (const item of items) {
      expect(areaIds.has(item.area), item.key).toBe(true)
      expect(item.labelAr, `${item.key} has no Arabic label`).toBeTruthy()
      expect(item.path.startsWith('/dashboard'), item.key).toBe(true)
    }
  })

  it('only references existing items in the role menus', () => {
    for (const profile of PROFILES) {
      for (const key of ROLE_NAV_KEYS[profile]) {
        expect(getNavItem(key), `${profile} → ${key}`).toBeDefined()
      }
    }
  })

  it('keeps each role menu stable', () => {
    // One representative role per menu.
    const ROLE_FOR: Record<PlatformRoleProfile, string | null> = {
      ministry_admin: 'ministry_admin',
      ministry_inspector: 'ministry_officer',
      hassad_supply: 'sourcing_manager',
      farm_operations: 'farm_manager',
      finance: 'finance_officer',
      default: null,
    }
    const menus = Object.fromEntries(
      PROFILES.map((profile) => {
        const role = ROLE_FOR[profile]
        const nav = buildNavigation(role, ministryProfileForRole(role))
        expect(resolvePlatformRoleProfile(role, ministryProfileForRole(role))).toBe(profile)
        return [profile, { landing: nav.landing, keys: nav.items.map((item) => item.key) }]
      })
    )
    expect(menus).toMatchSnapshot()
  })

  it('groups items by area in the registry order and never shows an empty group', () => {
    const nav = buildNavigation('ministry_admin', 'ministry_admin')
    const areaOrder = PRODUCT_AREAS.map((area) => area.id)
    const shown = nav.grouped.map((group) => group.area.id)
    expect(shown).toEqual(areaOrder.filter((id) => shown.includes(id)))
    for (const group of nav.grouped) expect(group.items.length).toBeGreaterThan(0)
  })

  it('maps roles to profiles', () => {
    expect(resolvePlatformRoleProfile(null, null)).toBe('default')
    expect(resolvePlatformRoleProfile('normal_user', null)).toBe('default')
    expect(resolvePlatformRoleProfile('hassad_admin', null)).toBe('hassad_supply')
    expect(resolvePlatformRoleProfile('farm_manager', null)).toBe('farm_operations')
    expect(resolvePlatformRoleProfile('qdb_admin', null)).toBe('finance')
    expect(resolvePlatformRoleProfile('member', 'ministry_inspector')).toBe('ministry_inspector')
    expect(ministryProfileForRole('super_admin')).toBe('ministry_admin')
    expect(ministryProfileForRole('ministry_officer')).toBe('ministry_inspector')
    expect(ministryProfileForRole('farm_manager')).toBeNull()
  })

  it('labels in the interface language', () => {
    const item = getNavItem('watchtower')!
    expect(navItemLabel(item, 'en')).toBe('National watchtower')
    expect(navItemLabel(item, 'ar')).toBe('برج المراقبة الوطني')
  })

  it('agrees with the module status shown on the page', () => {
    for (const item of allNavItems()) expect(getModuleStatus(item.key).status, item.key).toBe(item.availability)
  })

  it('recognises the harvest aliases', () => {
    expect(isHarvestModuleKey('production-harvest')).toBe(true)
    expect(isHarvestModuleKey('Harvest')).toBe(true)
    expect(isHarvestModuleKey('weather')).toBe(false)
  })
})
