/*
 * Arabic phrasebook, keyed by the English UI text (see `tr()` in context.tsx).
 * One file per area keeps merges simple; keys must be unique across files
 * (checked by lib/i18n/phrases.test.ts).
 */
import { INTELLIGENCE_AR } from './intelligence'
import { MAP_AR } from './map'
import { OPERATIONS_AR } from './operations'
import { PAGES_AR } from './pages'
import { SERVER_AR } from './server'
import { SHELL_AR } from './shell'

export const AR_PHRASE_GROUPS: Record<string, Record<string, string>> = {
  shell: SHELL_AR,
  map: MAP_AR,
  intelligence: INTELLIGENCE_AR,
  operations: OPERATIONS_AR,
  pages: PAGES_AR,
  server: SERVER_AR,
}

export const AR_PHRASES: Record<string, string> = Object.assign({}, ...Object.values(AR_PHRASE_GROUPS))
