'use client'

/**
 * Growa Qatar - Application Providers
 * Step 0.4: i18n baseline
 * Step 2.2: Auth context
 * 
 * Wraps the application with necessary providers.
 */

import { type ReactNode } from 'react'
import { I18nProvider } from '@/lib/i18n'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/features/auth-access'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <I18nProvider>
          {children}
        </I18nProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
