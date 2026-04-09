/**
 * Growa Qatar - Internationalization Utilities
 * Step 0.4: i18n baseline
 */

import { type Locale, type Direction, localeConfigs, defaultLocale, supportedLocales } from './types'

/**
 * Get the direction for a given locale.
 */
export function getDirection(locale: Locale): Direction {
  return localeConfigs[locale].direction
}

/**
 * Check if a locale is RTL.
 */
export function isRTL(locale: Locale): boolean {
  return getDirection(locale) === 'rtl'
}

/**
 * Get CSS classes for RTL/LTR support.
 */
export function getDirectionClasses(locale: Locale): string {
  return isRTL(locale) ? 'rtl' : 'ltr'
}

/**
 * Get the user's preferred locale from browser or storage.
 */
export function getPreferredLocale(): Locale {
  if (typeof window === 'undefined') {
    return defaultLocale
  }

  // Check localStorage first
  const stored = localStorage.getItem('growa-locale')
  if (stored && supportedLocales.includes(stored as Locale)) {
    return stored as Locale
  }

  // Check browser language
  const browserLang = navigator.language.split('-')[0]
  if (supportedLocales.includes(browserLang as Locale)) {
    return browserLang as Locale
  }

  return defaultLocale
}

/**
 * Format a number according to locale.
 */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-QA' : 'en-QA').format(value)
}

/**
 * Format a date according to locale.
 */
export function formatDate(date: Date, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
  return new Intl.DateTimeFormat(
    locale === 'ar' ? 'ar-QA' : 'en-QA',
    options || defaultOptions
  ).format(date)
}

/**
 * Format a relative time according to locale.
 */
export function formatRelativeTime(date: Date, locale: Locale): string {
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar-QA' : 'en-QA', {
    numeric: 'auto',
  })

  const now = new Date()
  const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000)
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (Math.abs(diffInDays) >= 1) {
    return rtf.format(diffInDays, 'day')
  }
  if (Math.abs(diffInHours) >= 1) {
    return rtf.format(diffInHours, 'hour')
  }
  if (Math.abs(diffInMinutes) >= 1) {
    return rtf.format(diffInMinutes, 'minute')
  }
  return rtf.format(diffInSeconds, 'second')
}

/**
 * Get text alignment class based on direction.
 */
export function getTextAlign(locale: Locale, align: 'start' | 'end' | 'center' = 'start'): string {
  if (align === 'center') return 'text-center'
  
  const isRtl = isRTL(locale)
  if (align === 'start') {
    return isRtl ? 'text-right' : 'text-left'
  }
  return isRtl ? 'text-left' : 'text-right'
}

/**
 * Get flex direction class based on direction.
 */
export function getFlexDirection(locale: Locale, reverse = false): string {
  const isRtl = isRTL(locale)
  if (reverse) {
    return isRtl ? 'flex-row' : 'flex-row-reverse'
  }
  return isRtl ? 'flex-row-reverse' : 'flex-row'
}
