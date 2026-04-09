/**
 * Growa Qatar - Internationalization Types
 * Step 0.4: i18n baseline
 */

export type Locale = 'en' | 'ar'

export type Direction = 'ltr' | 'rtl'

export interface LocaleConfig {
  code: Locale
  name: string
  nativeName: string
  direction: Direction
}

export const localeConfigs: Record<Locale, LocaleConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
  },
}

export const defaultLocale: Locale = 'en'
export const supportedLocales: Locale[] = ['en', 'ar']
