# NFII v2: Food supply and demand balance (first implementation slice)

Status: **implementation prepared for repository integration**. Deployment and end-to-end database validation are separate steps.

## What this implements

- Deterministic commodity-level supply and demand accounting (metric tonnes).
- Opening usable stock, production, confirmed imports, consumption, losses,
  projected balance, positive surplus or deficit, and projected coverage days.
- `insufficient_data` whenever the opening stock snapshot or any full-period
  coverage declaration is missing. No zero is inferred from missing records.
- Source references and clear distinction between LIVE and DEMO mode.
- A synthetic, non-persisted demonstration fixture for selected commodities.
- A tenant-scoped, `supply.view`-protected read-only Next.js endpoint.
- An interactive panel integrated into the existing Commodity workspace.
- Read-only Supabase schema with RLS, no synthetic national volume seed.

## Installation / review

1. Integrate the files in the Git repository after comparing against current `main`; the commodity catalog already includes milk/rice/wheat in newer commits.
2. Review the code and run `npm ci`, `npm run lint`, `npm test`,
   `npx tsc --noEmit`, and `npm run build`.
3. Test on an isolated local Supabase instance before applying migration 00039
   to staging. Historical migrations may have conflicts: do not reset production.
4. Verify authorization using at least two organization memberships and users
   with / without `supply.view`.
5. Open `/dashboard?module=commodities&commodityId=tomato` and select "Try demo".
6. Verify LIVE mode shows insufficient data until appropriate source data and
   coverage declarations have been loaded. Do not display this as national truth.

## Data contract

- `food_commodities`: commodity names and categories, all quantities in tonnes.
- `food_balance_stock_snapshots`: one organization-wide end-of-day *usable*
  inventory snapshot. The opening inventory must be a closing snapshot from exactly the day before the selected horizon.
- `food_balance_flows`: dated signed-by-type source facts, all values nonnegative.
  Imports are only those confirmed to arrive within the selected period.
- `food_balance_coverage`: explicit attestations that each source category is
  complete for an entire date interval. Partial coverage is never treated as zero.
- Each source movement has an `external_key` unique within the organization.

### Accounting identity

`projected_balance_t = opening_usable_t + domestic_production_t + confirmed_imports_t - consumption_t - losses_t`

`deficit_t = max(0, -projected_balance_t)`.

`closing_stock_t = max(0, projected_balance_t)`.

`projected_coverage_days = closing_stock_t / (consumption_t / period_days)`
when consumption > 0; otherwise it is unknown.

The model requires that events are not already part of the opening stock snapshot.
An older snapshot is rejected as stale instead of silently omitting intervening flows.
If a new, later stock snapshot supersedes older movements, the ingestion pipeline
must reconcile those records. This first slice does not have an ingestion API.

## API

`GET /api/food-security/balance?organizationId=<uuid>&commodityId=tomato&days=30&mode=live`

Options: days = 7/30/90/180, `mode` = live/demo, optional ISO `from` date.
Mode LIVE only reads tenant-scoped database data. Mode DEMO returns synthetic
non-persisted values and is marked `DEMO / SIMULATED` throughout.

## Known limitations and next phase

1. **No national federation yet.** This service computes one authorized
   organization's position. Country-level totals require explicit data-sharing,
   de-duplication, and policy-governed aggregation.
2. Source-coverage completeness is attested by an ingestion process; the next
   phase must audit/verify declarations against upstream sources.
3. Per-facility lots, reserved/blocked stock, spoilage prediction and orders
   are future layers. Opening stock is *usable*, excluding reserved/unusable.
4. No ingestion endpoint, procurement execution or agent tool-calling yet.
5. No actual Qatar national stock, production or demand data was supplied.
6. Date limits and 1,000-row read caps intentionally fail closed at larger
   volumes; introduce paginated/snapshot aggregations before national scaling.
7. The UI keeps legacy all-commodity Watchtower metrics separately labeled.
8. Code should be validated in Cursor against the full codebase; the dependency-free calculation core was typechecked and tested in isolation.

## Next recommended vertical slice

Connect verified forecast production, demand and shipment adapters, implement
source completeness checks, and build a country-level aggregation service
with explicit national permissions. Only then use the calculated balances in
national Watchtower KPI alerts and agent recommendations.

## Deterministic What-If sensitivity preview

The Commodity Intelligence balance panel now includes a non-persistent What-If preview.
It modifies aggregate assumptions for domestic production, confirmed imports,
period demand, and opening usable stock. A zero-shock scenario preserves the
source-backed balance; missing source inputs prevent a numeric simulation.

**This is not a national crisis simulator, a daily stockout model, or an
operational workflow.** It neither creates purchases nor changes warehouse
inventory. The source mode (LIVE organization data or synthetic DEMO) remains
visible, and the entire output is explicitly SIMULATED. There is no external
LLM-based numerical estimation.

The scenario math is covered by unit tests in
`lib/food-security/scenario.test.ts`. Run the repository CI quality gate,
including TypeScript, Vitest and Next.js build, before deploying.
