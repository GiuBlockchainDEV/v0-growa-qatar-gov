import { describe, expect, it } from 'vitest'
import { FOOD_CSV_COLUMNS, FOOD_CSV_MAX_RECORDS, parseFoodCsvCells, prepareFoodCsvImport } from './csv-import'

const organizationId = '11111111-1111-4111-8111-111111111111'
const common = { organizationId, commodityId: 'tomato' }
const stockCsv = [
  FOOD_CSV_COLUMNS.stock.join(','),
  'warehouse:20261031,observed,2026-10-31,125.25',
].join('\n')
const flowCsv = [
  FOOD_CSV_COLUMNS.flow.join(','),
  'customs:shipment-1,forecast,shipment-1,confirmed_import,2026-11-01,24.500',
].join('\n')

function parse(kind: 'stock' | 'flow' | 'coverage', csv: string) {
  return prepareFoodCsvImport({ ...common, kind, csv })
}

describe('NFII source CSV parsing', () => {
  it('accepts a BOM, CRLF and quoted commas in source references', () => {
    const csv = '\ufeffsourceRef,dataMode,asOfDate,usableTonnes\r\n' +
      '"report:stocktake, October",observed,2026-10-31,125.250\r\n'
    const result = parse('stock', csv)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.batch.records[0].sourceRef).toBe('report:stocktake, October')
  })

  it('handles escaped quotes and rejects newline in a prohibited reference', () => {
    expect(parseFoodCsvCells('"a""b",c\n')[0]).toEqual(['a"b', 'c'])
    expect(parse('stock', 'sourceRef,dataMode,asOfDate,usableTonnes\n"hello\nworld",observed,2026-10-31,1').ok).toBe(false)
  })

  it('imports a valid stock, flow and partial coverage', () => {
    expect(parse('stock', stockCsv).ok).toBe(true)
    expect(parse('flow', flowCsv).ok).toBe(true)
    const cov = 'sourceRef,dataMode,flowType,startDate,endDate,status\n' +
      'demand:scope-1,forecast,consumption,2026-11-01,2026-11-30,partial'
    const result = parse('coverage', cov)
    expect(result.ok).toBe(true)
    if (result.ok && result.batch.records[0].kind === 'coverage') {
      expect(result.batch.records[0].status).toBe('partial')
    }
  })

  it('permits column reordering while preserving record mapping', () => {
    const csv = 'usableTonnes,asOfDate,sourceRef,dataMode\n10.5,2026-10-31,warehouse:adjusted,estimated'
    const result = parse('stock', csv)
    expect(result.ok).toBe(true)
    if (result.ok && result.batch.records[0].kind === 'stock') {
      expect(result.batch.records[0].usableTonnes).toBe(10.5)
    }
  })

  it.each([
    'sourceRef,dataMode,asOfDate,usableTonnes\n',
    'sourceRef,dataMode,asOfDate,usableTonnes,organizationId\ns,observed,2026-10-31,1,xxx',
    'sourceRef,dataMode,asOfDate,usableTonnes\ns,observed,2026-10-31',
    'sourceRef,dataMode,asOfDate,usableTonnes\nwarehouse:1,observed,2026-02-30,1',
    'sourceRef,dataMode,asOfDate,usableTonnes\nwarehouse:1,observed,2026-10-31,-10',
    'sourceRef,dataMode,asOfDate,usableTonnes\nwarehouse:1,observed,2026-10-31,1.2345',
    'sourceRef,sourceRef,asOfDate,usableTonnes\nx,y,2026-10-31,1',
    'sourceRef,dataMode,asOfDate,usableTonnes\n"unfinished',
    'sourceRef,dataMode,asOfDate,usableTonnes\nwarehouse:1,observed,2026-10-31,1,unexpected',
  ])('rejects invalid or privileged CSV %#', (csv) => {
    expect(parse('stock', csv).ok).toBe(false)
  })

  it('rejects duplicate stock dates before any DB request', () => {
    const csv = stockCsv + '\nwarehouse:second,observed,2026-10-31,13'
    const result = parse('stock', csv)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('duplicate')
  })

  it('rejects repeated flow externalKey', () => {
    const result = parse('flow', flowCsv + '\ncustoms:shipment-2,observed,shipment-1,confirmed_import,2026-11-02,7')
    expect(result.ok).toBe(false)
  })

  it('caps per-file rows and bytes', () => {
    const rows = Array.from({ length: FOOD_CSV_MAX_RECORDS + 1 }, (_, i) =>
      'document:stocktake-' + i + ',observed,2026-10-31,' + i)
    expect(parse('stock', FOOD_CSV_COLUMNS.stock.join(',') + '\n' + rows.join('\n')).ok).toBe(false)
    expect(parse('stock', stockCsv + ' '.repeat(262_145)).ok).toBe(false)
  })

  it('does not accept client-defined organization or privilege fields', () => {
    expect(parse('stock', stockCsv.replace('sourceRef', 'verificationStatus')).ok).toBe(false)
    expect(prepareFoodCsvImport({ ...common, organizationId: 'wrong', kind: 'stock', csv: stockCsv }).ok).toBe(false)
  })

  it('rejects unverified invented demonstration sources', () => {
    expect(parse('stock', stockCsv.replace('warehouse:20261031', 'synthetic-fixture:warehouse')).ok).toBe(false)
  })
})
