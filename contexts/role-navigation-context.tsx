'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useRoleNavigation as useRoleNavigationState } from '@/hooks/use-role-navigation'

type RoleNavigationContextValue = ReturnType<typeof useRoleNavigationState>

const RoleNavigationContext = createContext<RoleNavigationContextValue | null>(null)

export function RoleNavigationProvider({ children }: { children: ReactNode }) {
  const value = useRoleNavigationState()
  return <RoleNavigationContext.Provider value={value}>{children}</RoleNavigationContext.Provider>
}

export function useSharedRoleNavigation() {
  const context = useContext(RoleNavigationContext)
  if (!context) {
    throw new Error('useSharedRoleNavigation must be used within RoleNavigationProvider')
  }
  return context
}
