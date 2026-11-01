/**
 * Strict RFC4180-style CSV intake for source-backed food records.
 * One commodity and record kind per file; caller-supplied organization IDs,
 * verification flags and audit fields are never accepted as CSV columns.
 */
import {
  type FoodSourceKind,
  type FoodSourceSubmission,
  validFoodUuid,
  validateFoodSourceSubmission,
} from './ingestion'

export const FOOD_CSV_MAX_BYTES = 262_144
export const FOOD_CSV_MAX_RECORDS = 200

export const FOOD_CSV_COLUMNS: Readonly<Record<FoodSourceKind, readonly string[]>> = {
  stock: ['sourceRef', 'dataMode', 'asOfDate', 'usableTonnes'],
  flow: ['sourceRef', 'dataMode', 'externalKey', 'flowType', 'effectiveDate', 'quantityTonnes'],
  coverage: ['sourceRef', 'dataMode', 'flowType', 'startDate', 'endDate', 'status'],
}

export interface FoodCsvBatch {
  kind: FoodSourceKind
  organizationId: string
  commodityId: string
  records: FoodSourceSubmission[]
}

export type FoodCsvPreparation =
  | { ok: true; batch: FoodCsvBatch }
  | { ok: false; error: string }

/** Handles CRLF, escaped quotes, embedded commas and quoted line breaks. */
export function parseFoodCsvCells(source: string): string[][] {
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let insideQuotes = false
  let justClosedQuote = false

  function endField() {
    row.push(cell.trim())
    cell = ''
    justClosedQuote = false
  }

  function endRow() {
    if (row.some((value) => value.length > 0)) rows.push(row)
    row = []
  }

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (insideQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          insideQuotes = false
          justClosedQuote = true
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      if (justClosedQuote || cell.trim() !== '') throw new Error('Invalid CSV quotation')
      cell = ''
      insideQuotes = true
      continue
    }
    if (ch === ',' || ch === '\n' || ch === '\r') {
      endField()
      if (ch !== ',') {
        endRow()
        if (ch === '\r' && source[i + 1] === '\n') i++
        if (rows.length > FOOD_CSV_MAX_RECORDS + 1) throw new Error('Too many CSV rows')
      }
      continue
    }
    if (justClosedQuote) {
      if (ch !== ' ' && ch !== '\t') throw new Error('Unexpected text after quoted CSV field')
      continue
    }
    cell += ch
  }
  if (insideQuotes) throw new Error('Unterminated quoted CSV field')
  if (cell.length > 0 || justClosedQuote || row.length > 0) {
    endField()
    endRow()
  }
  return rows
}

export function prepareFoodCsvImport(input: {
  kind: FoodSourceKind
  organizationId: string
  commodityId: string
  csv: string
}): FoodCsvPreparation {
  if (!validFoodUuid(input.organizationId)) return { ok: false, error: 'Invalid organizationId' }
  if (typeof input.commodityId !== 'string' ||
      !/^[a-z][a-z0-9_-]{1,49}$/.test(input.commodityId)) {
    return { ok: false, error: 'Invalid commodityId' }
  }
  if (!Object.prototype.hasOwnProperty.call(FOOD_CSV_COLUMNS, input.kind)) {
    return { ok: false, error: 'Invalid import kind' }
  }
  if (typeof input.csv !== 'string' || new TextEncoder().encode(input.csv).length > FOOD_CSV_MAX_BYTES) {
    return { ok: false, error: 'CSV exceeds 256 KiB limit' }
  }
  try {
    const rows = parseFoodCsvCells(input.csv)
    if (rows.length < 2) throw new Error('CSV needs a header and at least one data row')
    const columns = FOOD_CSV_COLUMNS[input.kind]
    const header = rows[0]
    if (header.length !== columns.length || new Set(header).size !== header.length ||
        header.some((key) => !columns.includes(key)) ||
        columns.some((key) => !header.includes(key))) {
      throw new Error('Invalid CSV headers. Expected exactly: ' + columns.join(', '))
    }
    const dataRows = rows.slice(1)
    if (dataRows.length > FOOD_CSV_MAX_RECORDS) throw new Error('Maximum 200 source records per CSV')
    const records: FoodSourceSubmission[] = []
    const unique = new Set<string>()
    for (let i = 0; i < dataRows.length; i++) {
      const fields = dataRows[i]
      if (fields.length !== header.length) {
        throw new Error('CSV row ' + (i + 2) + ': expected ' + header.length + ' fields')
      }
      const row = Object.fromEntries(header.map((key, index) => [key, fields[index]]))
      const parsed = validateFoodSourceSubmission({
        ...row,
        kind: input.kind,
        organizationId: input.organizationId,
        commodityId: input.commodityId,
      })
      if (!parsed.ok) throw new Error('CSV row ' + (i + 2) + ': ' + parsed.error)
      const entry = parsed.value
      const identity = entry.kind === 'flow'
        ? 'flow:' + entry.externalKey
        : entry.kind === 'stock'
          ? 'stock:' + entry.asOfDate
          : 'coverage:' + [entry.flowType, entry.startDate, entry.endDate, entry.sourceRef].join(':')
      if (unique.has(identity)) {
        throw new Error('CSV row ' + (i + 2) + ': duplicate source record (' + identity + ')')
      }
      unique.add(identity)
      records.push(entry)
    }
    return {
      ok: true,
      batch: {
        kind: input.kind, organizationId: input.organizationId,
        commodityId: input.commodityId, records,
      },
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Malformed CSV' }
  }
}
