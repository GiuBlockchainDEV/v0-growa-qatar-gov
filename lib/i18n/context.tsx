'use client'

/**
 * Growa Qatar - Internationalization Context
 * Step 0.4: i18n baseline
 * 
 * Provides locale and direction management for the application.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { type Locale, type Direction, localeConfigs, defaultLocale } from './types'

interface I18nContextValue {
  locale: Locale
  direction: Direction
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

interface I18nProviderProps {
  children: ReactNode
  initialLocale?: Locale
}

export function I18nProvider({ children, initialLocale = defaultLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const [translations, setTranslations] = useState<Record<string, string>>({})

  const direction = localeConfigs[locale].direction

  // Load translations when locale changes
  useEffect(() => {
    async function loadTranslations() {
      try {
        const module = await import(`./locales/${locale}.ts`)
        setTranslations(module.default || {})
      } catch {
        console.warn(`Failed to load translations for locale: ${locale}`)
        setTranslations({})
      }
    }
    loadTranslations()
  }, [locale])

  // Update document direction when locale changes
  useEffect(() => {
    document.documentElement.dir = direction
    document.documentElement.lang = locale
  }, [locale, direction])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    // Persist preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('growa-locale', newLocale)
    }
  }, [])

  const t = useCallback(
    (key: string): string => {
      return translations[key] || key
    },
    [translations]
  )

  return (
    <I18nContext.Provider value={{ locale, direction, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

export function useDirection() {
  const { direction } = useI18n()
  return direction
}

export function useLocale() {
  const { locale, setLocale } = useI18n()
  return { locale, setLocale }
}
