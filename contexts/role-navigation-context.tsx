'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useRoleNavigation as useRoleNavigationState } from '@/hooks/use-role-navigation'
import { buildPlatformNavigation } from '@/lib/navigation/platform-navigation'

type RoleNavigationContextValue = ReturnType<typeof useRoleNavigationState>

const RoleNavigationContext = createContext<RoleNavigationContextValue | null>(null)

export function RoleNavigationProvider({ children }: { children: ReactNode }) {
  const baseValue = useRoleNavigationState()
  const platformNav = useMemo(
    () => buildPlatformNavigation(baseValue.effectiveRole, baseValue.roleProfile),
    [baseValue.effectiveRole, baseValue.roleProfile]
  )

  const value = useMemo(
    () => ({
      ...baseValue,
      landingPage: platformNav.landing || baseValue.landingPage,
    }),
    [baseValue, platformNav.landing]
  )

  return <RoleNavigationContext.Provider value={value}>{children}</RoleNavigationContext.Provider>
}

export function useSharedRoleNavigation() {
  const context = useContext(RoleNavigationContext)
  if (!context) {
    throw new Error('useSharedRoleNavigation must be used within RoleNavigationProvider')
  }
  return context
}
