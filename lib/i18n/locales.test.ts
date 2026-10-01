import { describe, expect, it } from 'vitest'
import en from '@/lib/i18n/locales/en'
import ar from '@/lib/i18n/locales/ar'

describe('t() dictionaries', () => {
  it('have the same keys in English and Arabic', () => {
    const enKeys = Object.keys(en).sort()
    const arKeys = Object.keys(ar).sort()
    expect(arKeys.filter((k) => !(k in en))).toEqual([])
    expect(enKeys.filter((k) => !(k in ar))).toEqual([])
  })
})
