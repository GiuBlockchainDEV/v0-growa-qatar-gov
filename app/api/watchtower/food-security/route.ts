import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/require-capability'
import { validFoodUuid } from '@/lib/food-security/ingestion'
import {
  addFoodDays, calculateFoodBalance,
  type FoodBalanceFlow, type FoodCoverage, type FoodStockSnapshot,
} from '@/lib/food-security/balance'
import { COMMODITY_CATALOG } from '@/lib/platform/commodity-catalog'
import { buildFoodPosture } from '@/lib/watchtower/food-posture'

export const dynamic = 'force-dynamic'
const MAX_ROWS = 1000

function result(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status, headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

function qatarToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Qatar', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return get('year') + '-' + get('month') + '-' + get('day')
}

function latestReview(rows: ReadonlyArray<{ reviewed_at: string | null }>) {
  const timestamps = rows.map(row => row.reviewed_at).filter((v): v is string => Boolean(v))
  return timestamps.length ? timestamps.sort().at(-1) ?? null : null
}

/**
 * GET /api/watchtower/food-security?organizationId=<uuid>&days=30
 * One tenant, one timeframe, all catalogued commodities.
 * No global aggregation, demo numbers, mutations or LLM-generated metrics.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const organizationId = params.get('organizationId')?.trim()
  const daysText = params.get('days') ?? '30'
  if (!validFoodUuid(organizationId)) return result({ error: 'Valid organizationId required' }, 400)
  if (!['7', '30', '90', '180'].includes(daysText)) {
    return result({ error: 'days must be 7, 30, 90 or 180' }, 400)
  }
  const days = Number(daysText)
  const gate = await requireCapability('supply.view', organizationId)
  if (!gate.ok) return result({ error: gate.error }, gate.status)

  const fromDate = qatarToday()
  const toDate = addFoodDays(fromDate, days - 1)
  const openingDate = addFoodDays(fromDate, -1)
  const supabase = await createClient()
  const [stock, flows, coverage, pendingStock, pendingFlows, pendingCoverage] = await Promise.all([
    supabase.from('food_balance_stock_snapshots')
      .select('id, commodity_code, as_of_date, usable_tonnes, source_ref, data_mode, reviewed_at')
      .eq('organization_id', organizationId).eq('verification_status', 'verified')
      .eq('as_of_date', openingDate).limit(MAX_ROWS + 1),
    supabase.from('food_balance_flows')
      .select('id, commodity_code, external_key, flow_type, effective_date, quantity_tonnes, source_ref, data_mode, reviewed_at')
      .eq('organization_id', organizationId).eq('verification_status', 'verified')
      .gte('effective_date', fromDate).lte('effective_date', toDate)
      .limit(MAX_ROWS + 1),
    supabase.from('food_balance_coverage')
      .select('id, commodity_code, flow_type, start_date, end_date, status, source_ref, data_mode, reviewed_at')
      .eq('organization_id', organizationId).eq('verification_status', 'verified')
      .lte('start_date', toDate).gte('end_date', fromDate)
      .limit(MAX_ROWS + 1),
    supabase.from('food_balance_stock_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId).eq('verification_status', 'pending_review'),
    supabase.from('food_balance_flows')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId).eq('verification_status', 'pending_review'),
    supabase.from('food_balance_coverage')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId).eq('verification_status', 'pending_review'),
  ])

  const errors = [stock.error, flows.error, coverage.error].filter(Boolean)
  if (errors.length) {
    console.error('[watchtower/food] verified source reads failed', errors.map(e => e?.code))
    return result({
      error: 'Verified food source data unavailable; check migrations 00039/00040 and access.',
    }, 503)
  }
  if (
    (stock.data?.length ?? 0) >= MAX_ROWS ||
    (flows.data?.length ?? 0) >= MAX_ROWS ||
    (coverage.data?.length ?? 0) >= MAX_ROWS
  ) {
    return result({ error: 'Source row limit reached; safe aggregation needs pagination.' }, 422)
  }

  const stockRows = stock.data ?? []
  const flowRows = flows.data ?? []
  const coverageRows = coverage.data ?? []
  const pendingReads = [pendingStock, pendingFlows, pendingCoverage]
  const pendingReviewCount = pendingReads.every(r => !r.error && typeof r.count === 'number')
    ? pendingReads.reduce((n, r) => n + (r.count ?? 0), 0) : null

  try {
    const entries = COMMODITY_CATALOG.map(commodity => {
      const selectedStocks = stockRows.filter(r => r.commodity_code === commodity.id)
      const selectedFlows = flowRows.filter(r => r.commodity_code === commodity.id)
      const selectedCoverage = coverageRows.filter(r => r.commodity_code === commodity.id)
      const stocks: FoodStockSnapshot[] = selectedStocks.map(r => ({
        id: String(r.id), asOfDate: String(r.as_of_date),
        usableTonnes: Number(r.usable_tonnes), sourceRef: String(r.source_ref),
        dataMode: r.data_mode as FoodStockSnapshot['dataMode'],
      }))
      const mappedFlows: FoodBalanceFlow[] = selectedFlows.map(r => ({
        id: String(r.id), externalKey: String(r.external_key),
        flowType: r.flow_type as FoodBalanceFlow['flowType'],
        effectiveDate: String(r.effective_date), quantityTonnes: Number(r.quantity_tonnes),
        sourceRef: String(r.source_ref), dataMode: r.data_mode as FoodBalanceFlow['dataMode'],
      }))
      const mappedCoverage: FoodCoverage[] = selectedCoverage.map(r => ({
        id: String(r.id), flowType: r.flow_type as FoodCoverage['flowType'],
        startDate: String(r.start_date), endDate: String(r.end_date),
        status: r.status as FoodCoverage['status'],
        sourceRef: String(r.source_ref), dataMode: r.data_mode as FoodCoverage['dataMode'],
      }))
      return {
        commodity,
        balance: calculateFoodBalance({
          commodityId: commodity.id, fromDate, toDate, sourceMode: 'live',
          stocks, flows: mappedFlows, coverage: mappedCoverage,
        }),
        latestReviewedAt: latestReview([...selectedStocks, ...selectedFlows, ...selectedCoverage]),
      }
    })
    return result(buildFoodPosture({
      organizationId, fromDate, toDate, days,
      generatedAt: new Date().toISOString(), pendingReviewCount, entries,
    }))
  } catch (error) {
    console.error('[watchtower/food] failed source validation', error instanceof Error ? error.message : error)
    return result({ error: 'Verified food records failed deterministic validation.' }, 422)
  }
}
