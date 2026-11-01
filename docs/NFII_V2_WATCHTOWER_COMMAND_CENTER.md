# NFII v2 Watchtower: Food Security Command Center (v1)

## Scope and implementation

The existing Watchtower now displays a deterministic Food Security Command Center **above** its original agriculture, satellite and weather layers. The existing map, mission UI and operational signals remain available.

The new command center is deliberately **organization-scoped**, not a national aggregation. It can become a national system only after legally authorized multi-agency data sharing, deduplication, source normalization and independent validation.

### Source pipeline

1. The organization selects a 7, 30, 90 or 180-day horizon.
2. \`GET /api/watchtower/food-security?organizationId=<uuid>&days=30\` checks \`supply.view\` on the selected organization.
3. Only rows with \`verification_status='verified'\` from food stock, movement and coverage tables are loaded.
4. The existing \`calculateFoodBalance\` deterministic service calculates each commodity, with a prior-day stock snapshot and four independently reviewed complete-coverage declarations.
5. A pure \`buildFoodPosture\` function assigns a **screening** band to each fully assessed commodity and reports missing data separately.
6. The UI displays a per-commodity board, coverage and import inflow share, source readiness, pending reviews and investigation links.

No AI model generates metrics. The endpoint does not read from the synthetic fixture, modify inventory, create a purchase order or approve a source.

## Screening logic (NOT official policy)

- A verified negative horizon-end balance is **critical**.
- Otherwise, projected coverage < 7 days is **critical**.
- Coverage 7-13.9 days is **high**.
- Coverage 14-29.9 days is **attention**.
- Coverage >= 30 days is shown as **assessed**.
- If stock or coverage is missing, or consumption is zero/undefined, the risk band is **unknown**, not safe.

These bands are operational heuristics, **not Qatar government food security thresholds**. Real policy thresholds should be centrally configured and institutionally approved before use in critical operations.

**Do not interpret days of coverage as a simulation of daily stockouts.** The balance engine currently calculates a horizon-end result using aggregate flows.

## Data integrity

- Source rows are restricted to the explicitly selected organization and verified status.
- The user must hold \`supply.view\`; the browser cannot select another organization without server authorization.
- Pending and rejected source rows cannot contribute to the balances.
- Missing category coverage never becomes a zero estimate.
- Sources that exceed the safe query row limit are rejected with an error rather than silently truncating results.
- Requests set \`Cache-Control: private, no-store\`.
- A failing food endpoint shows its own error without concealing unrelated agricultural monitoring.
- Conversely, a failure of the legacy agricultural summary leaves the Food Security Command Center available.
- The page makes a visible distinction between legacy operational data and reviewed food balances.

The **import inflow share** is calculated only from domestic production and confirmed imports in the selected horizon. It is NOT national import dependency and excludes opening inventory.

## Deployment

- Database migrations \`00039\` and \`00040\` must be installed (no new migration in this slice).
- Two different authorized people must submit and verify each new source row.
- The application server must have its normal Supabase configuration; no new secrets.
- Open \`/dashboard?module=watchtower\` with an active organization that grants \`supply.view\`.
- For the selected commodity, ensure an end-of-day stock snapshot dated the day before the forecast, plus verified production/import/consumption/loss movements and complete period coverage.
- The command center links to the detailed Commodity Intelligence module for source review and what-if scenarios.

## Remaining gaps before a national operating system

- Multi-agency data agreements and government-approved organizational scopes.
- National aggregation with source lineage and cross-tenant deduplication.
- Daily physical inventory, lot expiries, food safety and Strategic Reserves FEFO.
- Central, versioned government risk policies (current bands are heuristics).
- Time-series disruption scenario engine and independent validation of numerical models.
- Actual logistics, procurement, import authority and forecasting connectors.
- Live incident response workflows and actual specialist agent tool execution.
- End-to-end staging verification of RLS and real Supabase source ingestion.
- Review of legacy Watchtower sources: some operational/harvest modules are broader than the new scoped food engine and should not be presented as official national results.

## Verification

GitHub Actions should run lint, Vitest, \`tsc --noEmit\`, and Next.js production build.
New unit tests cover: deficit triage, coverage thresholds, missing evidence, preservation of organization scope, and exclusion of DEMO data.
An authorized staging test must still verify:
- user with \`supply.view\` succeeds for their organization;
- unauthenticated/unauthorized users receive 401/403;
- pending/rejected records do not change food KPIs;
- verified complete records generate the expected commodity entry;
- organization switch clears the previous food board;
- missing/oversized datasets never generate a false all-clear.
