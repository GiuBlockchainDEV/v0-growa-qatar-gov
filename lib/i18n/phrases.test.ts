import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AR_PHRASES, AR_PHRASE_GROUPS } from '@/lib/i18n/phrases'

/* Every `tr('…')` phrase used in the UI must have an Arabic entry. */

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sourceFiles(path, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path)
  }
  return out
}

function usedPhrases(): Map<string, string> {
  const found = new Map<string, string>()
  const call = /\btr\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*[,)]/g
  for (const file of [...sourceFiles('app'), ...sourceFiles('components')]) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(call)) {
      const phrase = match[2]!.replace(/\\(['"\\])/g, '$1')
      if (!found.has(phrase)) found.set(phrase, file)
    }
  }
  return found
}

describe('Arabic phrasebook', () => {
  it('translates every phrase used with tr()', () => {
    const missing = [...usedPhrases()].filter(([phrase]) => !(phrase in AR_PHRASES)).map(([p, f]) => `${f}: ${p}`)
    expect(missing).toEqual([])
  })

  it('has no key defined twice across groups', () => {
    const seen = new Map<string, string>()
    const duplicates: string[] = []
    for (const [group, phrases] of Object.entries(AR_PHRASE_GROUPS)) {
      for (const key of Object.keys(phrases)) {
        if (seen.has(key)) duplicates.push(`${key} (${seen.get(key)} and ${group})`)
        else seen.set(key, group)
      }
    }
    expect(duplicates).toEqual([])
  })

  it('keeps placeholders in the Arabic text', () => {
    const broken = Object.entries(AR_PHRASES).filter(([en, ar]) => {
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
      return vars(en) !== vars(ar)
    })
    expect(broken).toEqual([])
  })
})
