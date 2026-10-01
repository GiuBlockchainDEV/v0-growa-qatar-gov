'use client'

/**
 * Growa Qatar - Internationalization Context
 * Step 0.4: i18n baseline
 * 
 * Provides locale and direction management for the application.
 */

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { type Locale, type Direction, localeConfigs, defaultLocale, LOCALE_COOKIE } from './types'
import enTranslations from './locales/en'
import arTranslations from './locales/ar'
import { getPreferredLocale } from './utils'
import { AR_PHRASES } from './phrases'

interface I18nContextValue {
  locale: Locale
  direction: Direction
  setLocale: (locale: Locale) => void
  t: (key: string) => string
  /**
   * Translate an English UI phrase: `tr('Loading farms…')`,
   * `tr('Showing {count} farms', { count })`. The English text is the key;
   * Arabic lives in `lib/i18n/phrases/`. A test fails when a phrase used in
   * the code has no Arabic entry. When one English word needs two Arabic
   * translations, add a context after a bar: `tr('Open|status')` shows "Open".
   */
  tr: (english: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

interface I18nProviderProps {
  children: ReactNode
  initialLocale?: Locale
}

function persistLocale(locale: Locale) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('growa-locale', locale)
  } catch {
    /* storage blocked: the cookie still carries the choice */
  }
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
}

const localeDictionaries: Record<Locale, Record<string, string>> = {
  en: enTranslations,
  ar: arTranslations,
}

export function I18nProvider({ children, initialLocale = defaultLocale }: I18nProviderProps) {
  // Same value on server and client (from the cookie): no hydration mismatch.
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const direction = localeConfigs[locale].direction

  // Sessions from before the cookie only have localStorage: adopt it once
  // after mount (and write the cookie so the next page load is right).
  useEffect(() => {
    const preferred = getPreferredLocale()
    if (preferred !== initialLocale) {
      setLocaleState(preferred)
      persistLocale(preferred)
    }
  }, [initialLocale])

  // Update document direction when locale changes
  useEffect(() => {
    document.documentElement.dir = direction
    document.documentElement.lang = locale
  }, [locale, direction])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState((current) => (current === newLocale ? current : newLocale))
    persistLocale(newLocale)
  }, [])

  const t = useCallback(
    (key: string): string => {
      const translations = localeDictionaries[locale] || {}
      return translations[key] || key
    },
    [locale]
  )

  const tr = useCallback(
    (english: string, vars?: Record<string, string | number>): string => {
      // `'Open|status'`: the part after `|` only disambiguates the key (the
      // same English word with two meanings); it is never displayed.
      const display = english.includes('|') ? english.slice(0, english.indexOf('|')) : english
      const phrase = locale === 'ar' ? AR_PHRASES[english] ?? display : display
      if (!vars) return phrase
      return phrase.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
    },
    [locale]
  )

  const value = useMemo(() => ({ locale, direction, setLocale, t, tr }), [locale, direction, setLocale, t, tr])

  return (
    <I18nContext.Provider value={value}>
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
