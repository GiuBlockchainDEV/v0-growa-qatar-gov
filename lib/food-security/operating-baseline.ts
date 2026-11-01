import qatarPlanning from '@/supabase/seeds/qatar-2026-sandbox/03_dataset_preview.json'
import { addFoodDays, type FoodBalanceInput } from '@/lib/food-security/balance'
import { COMMODITY_CATALOG } from '@/lib/platform/commodity-catalog'
import { calculateFoodBalance } from '@/lib/food-security/balance'
import { buildFoodPosture, type FoodPosture } from '@/lib/watchtower/food-posture'

const FLOW_TYPES = ['domestic_production', 'confirmed_import', 'consumption', 'loss'] as const

function sourceRoot(commodityId: string) {
  return `QA/FS-2026/${commodityId.toUpperCase()}`
}

/** Qatar-aligned daily planning assumptions for organization food balances. */
export function buildOperatingFoodBalanceInput(
  commodityId: string,
  fromDate: string,
  days: number
): FoodBalanceInput {
  if (![7, 30, 90, 180].includes(days)) {
    throw new Error('Unsupported planning horizon')
  }
  const row = qatarPlanning.commodity_daily_assumptions_tonnes.find(
    (entry) => entry.commodity === commodityId
  )
  if (!row) {
    throw new Error('Unknown commodity ' + commodityId)
  }
  const root = sourceRoot(commodityId)
  const flows: FoodBalanceInput['flows'] = []
  for (let offset = 0; offset < days; offset += 1) {
    for (const flowType of FLOW_TYPES) {
      let multiplier = 1
      if (['tomato', 'cucumber', 'pepper', 'lettuce'].includes(commodityId)) {
        if (flowType === 'domestic_production') {
          multiplier = offset < 90 ? 1.1 : offset < 150 ? 0.75 : 0.45
        } else if (flowType === 'confirmed_import') {
          multiplier = offset < 90 ? 0.9 : offset < 150 ? 1.15 : 1.4
        }
      }
      flows.push({
        id: `${commodityId}-${flowType}-${offset}`,
        externalKey: `QA-FS-2026-${commodityId}-${flowType}-${offset}`,
        flowType,
        effectiveDate: addFoodDays(fromDate, offset),
        quantityTonnes: Math.round(row[flowType] * multiplier * 1000) / 1000,
        sourceRef: `${root}/${flowType}`,
        dataMode: 'estimated',
      })
    }
  }
  const toDate = addFoodDays(fromDate, days - 1)
  return {
    commodityId,
    fromDate,
    toDate,
    sourceMode: 'live',
    stocks: [
      {
        id: `${commodityId}-opening`,
        asOfDate: addFoodDays(fromDate, -1),
        usableTonnes: row.opening,
        sourceRef: `${root}/OPENING`,
        dataMode: 'estimated',
      },
    ],
    flows,
    coverage: FLOW_TYPES.map((flowType) => ({
      id: `${commodityId}-coverage-${flowType}`,
      flowType,
      startDate: fromDate,
      endDate: toDate,
      status: 'complete' as const,
      sourceRef: `${root}/COVERAGE/${flowType}`,
      dataMode: 'estimated',
    })),
  }
}

export function buildOperatingFoodPosture(
  organizationId: string,
  fromDate: string,
  days: 7 | 30 | 90 | 180
): FoodPosture {
  const toDate = addFoodDays(fromDate, days - 1)
  const reviewedAt = new Date().toISOString()
  const entries = COMMODITY_CATALOG.map((commodity) => ({
    commodity,
    balance: calculateFoodBalance(buildOperatingFoodBalanceInput(commodity.id, fromDate, days)),
    latestReviewedAt: reviewedAt,
  }))
  return buildFoodPosture({
    organizationId,
    fromDate,
    toDate,
    days,
    generatedAt: reviewedAt,
    pendingReviewCount: 2,
    entries,
  })
}
