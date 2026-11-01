# NFII 2.0 | ICPS-inspired Food Resilience Watchtower (v1)

## Source of product inspiration

User-supplied single-file HTML demonstration: **Intelligent Central Purchasing & National Resilience System (ICPS) Demo_Qatar(7).html**, titled "Qatar National Food Supply Command Center".

The demonstration presents six conceptual capabilities: a national purchasing-risk Watchtower, procurement/tender management, logistics corridors, strategic reserve tracking, disruption scenario analysis, and governance/data lineage, supported by agent-led analysis and human decisions.

This NFII implementation **adapts the product architecture and command-center interaction patterns**, not the bundled code, brand identity or synthetic numbers from that demo. It must not present the fictional government identities, tenders, batches, sea routes, prices, risk events or AI-tool executions in the demonstration as real Qatar data.

## Actual changes

**1. Watchtower command shell**

A compact situational header distinguishes the national ambition of the platform from the actual organization-scoped state of data. Tabs navigate directly to the food situation, purchasing risk desk, and scenario analysis. It preserves EN/AR labels and the existing NFII navigation and authentication.

**2. Supply resilience & procurement decision queue**

A pure deterministic engine \`lib/watchtower/resilience-queue.ts\` ranks review work based exclusively on the output of \`GET /api/watchtower/food-security\`, which only uses independently reviewed, tenant-scoped sources:

- **P0**: complete reviewed balance with projected deficit > 0 t. Review the gap and potential sourcing alternatives.
- **P1**: assessed commodity with screening coverage below 14 days but no identified deficit.
- **P2**: assessed commodity with 14-29.9 projected days of coverage.
- **EVIDENCE**: missing stock, incomplete source period declarations, or an undefined demand baseline. This is intentionally **not** a verified shortage or an instruction to procure.
- **No action**: fully assessed commodity without a screening signal.

These priority labels are provisional product conventions, **not Qatar government procurement policy**. All calculations retain the selected horizon and organization.

Queue action buttons open the corresponding Commodity Intelligence details. They do **not** create orders, RFQs, case records, supplier selections, reserve releases, alerts or automatic AI decisions.

**3. Supply network integration readiness**

The Watchtower explicitly lists currently unsupported domains of the **verified food balance data model**:

- Ports, vessels, ETA and trade corridor risk.
- Procurement tenders, RFQs, quoted supplier prices and landed-cost comparisons.
- Warehouse/strategic reserve lot identities, expiry, depot assignment and release authority.

These are shown as **not integrated** rather than fabricated as healthy/active government sources. An independent reviewer is still required for each source record. The existing Data Health screen remains accessible.

**4. Scenario assessment playbook**

The already implemented read-only shock simulator now shows a four-stage **draft checklist** when a complete verified baseline is available and shocks are selected. It reminds users to check source quality, compare supplier logistics only once integrated, inspect usable reserves once lot data is integrated, and obtain human authorization.

This is not a persistent incident response workflow. No live action is dispatched, and no task is written into a database.

**5. Regression tests**

\`lib/watchtower/resilience-queue.test.ts\` verifies triage ordering, deficit vs missing evidence separation, no action for safe assessed commodities, and rejection of demo/national scope contexts.

Existing Watchtower regression tests must continue to confirm no legacy farm telemetry, generic IoT signal map, water or climate metrics reappear in the core NFII command screen.

## Data boundaries and constraints

- Only \`sourceMode='live'\`, \`scope='organization'\` sources contribute to decision triage.
- No legal national data aggregation, shared government agency database, national reserve movements or port feed is added.
- No extra SQL migration or new credentials are required for this UI/logic version. The existing Supabase 00039/00040 ingestion/review setup remains in force.
- Review status is NOT independent ministry certification.
- The Food Balance Model remains an aggregate period-based calculator, not a per-day stockout or multi-leg shipment model.
- A "not assessed" commodity must never be shown as stocked or safe.
- Shipping routes, purchasing costs and lot-level release feasibility are omitted until backed by authorized data.

## Roadmap based on the ICPS concept

1. Government-approved agency and supplier source registry with provenance, review and freshness.
2. Contracts, RFQs, quotations, landed cost and supplier risk. All decisions require role-based approvals and immutable audit.
3. Ports and supply corridors with actual ETA/port telemetry and regional risk events, clearly scoped by evidence.
4. Warehouse and strategic reserve lot ledger, FEFO policies and controlled release.
5. Scenario engine over day-level flows, import interruptions, procurement capacity and expiry-driven losses.
6. Central response case management with human-in-the-loop approvals and *actual* tool-backed specialized AI agents.
7. National data federation and aggregated reporting only when legally and technically permitted.

## Verification

GitHub Actions: \`npm run lint\`, \`npm test\`, \`npx tsc --noEmit\`, \`npm run build\`.

Manual staging validation still required: organization switching, no data fallback, EN/AR UI, scoping, reviewer separation, and source QA against migration 00040.
