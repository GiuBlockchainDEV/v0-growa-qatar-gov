'use client'

/**
 * Growa Qatar - Application Providers
 * Step 0.4: i18n baseline
 * Step 2.2: Auth context
 * 
 * Wraps the application with necessary providers.
 */

import { type ReactNode } from 'react'
import { I18nProvider, type Locale } from '@/lib/i18n'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/features/auth-access'
import { FeedbackProvider } from '@/components/brand/feedback'

interface ProvidersProps {
  children: ReactNode
  initialLocale?: Locale
}

export function Providers({ children, initialLocale }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      // Growa brand is light-first: white / stone-50 surfaces, ink only for
      // inverse moments (`.growa-inverse`). The old forced dark console is
      // retired; `forcedTheme` keeps a stale "dark" in localStorage from
      // re-applying the `.dark` class and its 43 `dark:` variants.
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AuthProvider>
        <I18nProvider initialLocale={initialLocale}>
          {/* Brand toasts and confirmations: replace alert() / confirm(). */}
          <FeedbackProvider>
            {children}
          </FeedbackProvider>
        </I18nProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
