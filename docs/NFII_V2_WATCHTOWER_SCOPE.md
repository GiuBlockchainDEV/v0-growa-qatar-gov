# NFII 2.0: Watchtower scope cleanup

## Change rationale

The first Food Security Command Center was embedded inside the older Growa agricultural-monitoring Watchtower. That older page rendered a satellite field map, agricultural production tiles, weather, energy and water monitoring, a mixed operational signal feed, crop activity history, and a legacy AI briefing. These may be useful in specialized modules, but they are not the primary dashboard for a Qatar national Food Intelligence Infrastructure.

This change removes those **components from the Watchtower page only**. It does not remove their source files, API routes or other navigation modules. This avoids breaking separate agricultural operations and analytics workflows.

## Watchtower now contains

1. **Food Security Command Center**: commodity-specific, independently reviewed supply/demand balances; deficit, coverage, import inflow share, risk screening, data completeness, pending review; organization scope.
2. **Disruption Scenario Workbench**: read-only sensitivity simulation for production shortfall, confirmed import reduction, increased demand and opening inventory loss, using the selected commodity's verified live balance. The outcome is unavailable when source coverage is incomplete.
3. **Commodity Investigation**: direct navigation to existing source review, CSV intake, detailed balance and scenario UI.
4. **Clearly scoped provenance notice**: reviewed organizational data are not equivalent to independently certified national food security statistics.

English/Arabic copy is inline in this refactor to preserve translation coverage without adding untranslated keys.

## Removed from Watchtower UI

- Generic field satellite map, map layers and crop-health cards.
- Weather and climate station KPI cards.
- Irrigation water-intensity and energy-intensity KPI cards.
- Generic farm production and harvest signal summary.
- Cross-module "what changed" feed without food evidence.
- Legacy general-purpose AI briefing and speculative general intelligence context.
- Mixed-source WatchtowerContextDeck and supply contract tiles unrelated to the reviewed commodity ledger.
- Dependence on the older `/api/watchtower/summary` API for the Watchtower page to render.

**Not deleted:** These features still exist elsewhere where appropriate. The legacy summary endpoint is still used by some other views; this update deliberately does not change its behavior.

## Boundaries and operating requirements

- This is **organization scoped**, not official nationwide aggregation.
- Source verification is governed by the existing migrations `00039` and `00040`. No migration is required.
- The Food Security Command Center requires `supply.view` for the selected organization.
- The Scenario Workbench calls only `GET /api/food-security/balance` with `mode=live`; no synthetic-data fallback, no DB writes and no purchasing actions.
- Risk bands use demonstration screening thresholds (7/14/30 days). They require policy approval before critical national operations.
- Scenario results are aggregate sensitivities, not a daily stockout forecast or actual shipment simulation.
- Missing source coverage results in an explicit not-ready state, not an invented zero, green status or fake intervention.
- Platform administration, account roles and organization memberships remain unchanged.

## Validation

- Existing GitHub Actions: lint, unit tests, TypeScript and Next.js production build.
- New static scope tests assert the Watchtower no longer imports or renders the unrelated legacy components.
- End-to-end testing with real Supabase credentials and two independent authorized reviewers remains necessary.
- Verify that switching organizations clears previous food data, and that a user without `supply.view` sees a permission error rather than another tenant's data.
- Verify that the page loads the command center even when the legacy agricultural summary endpoint is offline.

## Future aligned capabilities

Real national food security operation will require an authorized government-approved federation layer, source-level agency sharing permissions, strategic inventory lots and expiration-aware stock, customs/ports connectors, logistics disruption modeling, source attestation, incident approvals and actual AI agent tools. Those modules are not represented as implemented simply by adding dashboard cards.
