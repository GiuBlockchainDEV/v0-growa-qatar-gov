'use client'

/**
 * Growa Qatar - Internationalization Context
 * Step 0.4: i18n baseline
 * 
 * Provides locale and direction management for the application.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { type Locale, type Direction, localeConfigs, defaultLocale } from './types'
import enTranslations from './locales/en'
import arTranslations from './locales/ar'
import { getPreferredLocale } from './utils'

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

const localeDictionaries: Record<Locale, Record<string, string>> = {
  en: enTranslations,
  ar: arTranslations,
}

export function I18nProvider({ children, initialLocale = defaultLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return initialLocale
    return getPreferredLocale()
  })

  const direction = localeConfigs[locale].direction

  // Sync locale from persisted preference on first client mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const preferred = getPreferredLocale()
    setLocaleState((current) => (current === preferred ? current : preferred))
  }, [])

  // Update document direction when locale changes
  useEffect(() => {
    document.documentElement.dir = direction
    document.documentElement.lang = locale
  }, [locale, direction])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState((current) => (current === newLocale ? current : newLocale))
    // Persist preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('growa-locale', newLocale)
    }
  }, [])

  const t = useCallback(
    (key: string): string => {
      const translations = localeDictionaries[locale] || {}
      return translations[key] || key
    },
    [locale]
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
