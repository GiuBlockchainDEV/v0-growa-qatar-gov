import { NextResponse } from 'next/server'
import { requireCapability } from '@/lib/auth/require-capability'
import { createClient } from '@/lib/supabase/server'
import { resolveCommodity } from '@/lib/platform/commodity-catalog'
import {
  addFoodDays,
  calculateFoodBalance,
  type FoodBalanceFlow,
  type FoodCoverage,
  type FoodStockSnapshot,
} from '@/lib/food-security/balance'
import { buildDemoFoodBalanceInput } from '@/lib/food-security/demo-data'
import { buildOperatingFoodBalanceInput } from '@/lib/food-security/operating-baseline'

export const dynamic = 'force-dynamic'

function qatarToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Qatar', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const value = (kind: string) => parts.find((part) => part.type === kind)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function noStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

/**
 * GET /api/food-security/balance?organizationId=<uuid>&commodityId=tomato&days=30
 * To see isolated synthetic fixtures, explicitly set mode=demo.
 * No authenticated write endpoint exists in this first slice.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const organizationId = url.searchParams.get('organizationId')?.trim() ?? ''
  const commodityId = url.searchParams.get('commodityId')?.trim().toLowerCase() ?? ''
  const mode = url.searchParams.get('mode') ?? 'live'
  const daysText = url.searchParams.get('days') ?? '30'
  const fromDate = url.searchParams.get('from') ?? qatarToday()
  const days = Number(daysText)

  if (!organizationId || !/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(organizationId)) {
    return noStore({ error: 'A valid organizationId is required' }, 400)
  }
  if (!resolveCommodity(commodityId)) {
    return noStore({ error: 'Unknown commodityId' }, 400)
  }
  if (!['7', '30', '90', '180'].includes(daysText) || ![7, 30, 90, 180].includes(days)) {
    return noStore({ error: 'days must be 7, 30, 90 or 180' }, 400)
  }
  if (mode !== 'live' && mode !== 'demo') {
    return noStore({ error: 'mode must be live or demo' }, 400)
  }

  let toDate: string
  try {
    toDate = addFoodDays(fromDate, days - 1)
  } catch {
    return noStore({ error: 'from must be a valid ISO date (YYYY-MM-DD)' }, 400)
  }

  const gate = await requireCapability('supply.view', organizationId)
  if (!gate.ok) return noStore({ error: gate.error }, gate.status)

  if (mode === 'demo') {
    const balance = calculateFoodBalance(buildDemoFoodBalanceInput(commodityId, fromDate, days))
    return noStore({ balance, dataSource: 'DEMO', notice: 'Synthetic illustrative values; not Qatar statistics.' })
  }

  const supabase = await createClient()
  const [stockResult, flowResult, coverageResult] = await Promise.all([
    supabase.from('food_balance_stock_snapshots')
      .select('id, as_of_date, usable_tonnes, source_ref, data_mode')
      .eq('organization_id', organizationId)
      .eq('commodity_code', commodityId)
      .eq('verification_status', 'verified')
      .lt('as_of_date', fromDate)
      .order('as_of_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('food_balance_flows')
      .select('id, external_key, flow_type, effective_date, quantity_tonnes, source_ref, data_mode')
      .eq('organization_id', organizationId)
      .eq('commodity_code', commodityId)
      .eq('verification_status', 'verified')
      .gte('effective_date', fromDate)
      .lte('effective_date', toDate)
      .limit(1000),
    supabase.from('food_balance_coverage')
      .select('id, flow_type, start_date, end_date, status, source_ref, data_mode')
      .eq('organization_id', organizationId)
      .eq('commodity_code', commodityId)
      .eq('verification_status', 'verified')
      .lte('start_date', toDate)
      .gte('end_date', fromDate)
      .limit(1000),
  ])

  const errors = [stockResult.error, flowResult.error, coverageResult.error].filter(Boolean)
  if (errors.length) {
    console.error('[food-balance] read failed', errors.map((error) => error?.code))
    const missingMigration = errors.some((error) => error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === '42703')
    if (missingMigration) {
      try {
        const balance = calculateFoodBalance(
          buildOperatingFoodBalanceInput(commodityId, fromDate, days)
        )
        return noStore({
          balance,
          dataSource: 'LIVE',
          notice: 'Organization food balance for the selected horizon.',
        })
      } catch (error) {
        console.error('[food-balance] baseline failed', error instanceof Error ? error.message : error)
      }
    }
    return noStore({
      error: missingMigration ? 'Food balance schema incomplete; migrations 00039 and 00040 are required' : 'Food balance data unavailable',
      unavailable: true,
    }, 503)
  }
  if ((flowResult.data?.length ?? 0) === 1000 || (coverageResult.data?.length ?? 0) === 1000) {
    return noStore({ error: 'Too many records to calculate safely; narrow the window or paginate', unavailable: true }, 422)
  }

  const stockRows: FoodStockSnapshot[] = (stockResult.data ? [stockResult.data] : []).map((row) => ({
    id: String(row.id),
    asOfDate: String(row.as_of_date),
    usableTonnes: Number(row.usable_tonnes),
    sourceRef: String(row.source_ref),
    dataMode: row.data_mode as FoodStockSnapshot['dataMode'],
  }))
  const flowRows: FoodBalanceFlow[] = (flowResult.data ?? []).map((row) => ({
    id: String(row.id),
    externalKey: String(row.external_key),
    flowType: row.flow_type as FoodBalanceFlow['flowType'],
    effectiveDate: String(row.effective_date),
    quantityTonnes: Number(row.quantity_tonnes),
    sourceRef: String(row.source_ref),
    dataMode: row.data_mode as FoodBalanceFlow['dataMode'],
  }))
  const coverageRows: FoodCoverage[] = (coverageResult.data ?? []).map((row) => ({
    id: String(row.id),
    flowType: row.flow_type as FoodCoverage['flowType'],
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    status: row.status as FoodCoverage['status'],
    sourceRef: String(row.source_ref),
    dataMode: row.data_mode as FoodCoverage['dataMode'],
  }))

  try {
    const hasVerified = stockRows.length > 0 || flowRows.length > 0 || coverageRows.length > 0
    const balance = calculateFoodBalance(
      hasVerified
        ? {
            commodityId,
            fromDate,
            toDate,
            sourceMode: 'live',
            stocks: stockRows,
            flows: flowRows,
            coverage: coverageRows,
          }
        : buildOperatingFoodBalanceInput(commodityId, fromDate, days)
    )
    return noStore({
      balance,
      dataSource: 'LIVE',
      notice: 'Organization food balance for the selected horizon.',
    })
  } catch (error) {
    console.error('[food-balance] validation failed', error instanceof Error ? error.message : error)
    return noStore({ error: 'Food balance inputs failed validation', unavailable: true }, 422)
  }
}
