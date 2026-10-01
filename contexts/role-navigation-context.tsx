'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useRoleNavigation } from '@/hooks/use-role-navigation'

type RoleNavigationContextValue = ReturnType<typeof useRoleNavigation>

const RoleNavigationContext = createContext<RoleNavigationContextValue | null>(null)

/* One role resolution for the whole dashboard: rail, header, layout and
   pages read it from here instead of each running the hook. */
export function RoleNavigationProvider({ children }: { children: ReactNode }) {
  const value = useRoleNavigation()
  return <RoleNavigationContext.Provider value={value}>{children}</RoleNavigationContext.Provider>
}

export function useSharedRoleNavigation() {
  const context = useContext(RoleNavigationContext)
  if (!context) {
    throw new Error('useSharedRoleNavigation must be used within RoleNavigationProvider')
  }
  return context
}
