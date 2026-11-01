# NFII v2: source intake, independent review, and food balances

## Implemented boundaries

The food balance is **per organization**, not a verified nationwide Qatar total.

- Migration `00039_food_security_balance.sql` supplies immutable source identities and the base inventory/flow/coverage model.
- Migration `00040_food_balance_source_review.sql` adds independent review, author identity, review status, and a transactionally written event ledger.
- `POST /api/food-security/records` accepts one manual source record at a time, only for a user with `supply.edit` in that organization.
- `GET /api/food-security/records` lists recently submitted sources within the user's `supply.view` organization.
- `POST /api/food-security/records/review` uses `decisions.approve`. **The submitter cannot review their own entry.**
- `GET /api/food-security/balance` includes **only verified** stock, flows and coverage, while `mode=demo` remains wholly synthetic.
- All privileged data writes are server-side, organization-scoped, non-upserting, and leave an immutable database audit event. A duplicate stock date, movement external key, or coverage declaration is rejected.

`verified` means **independently reviewed by an authorized user in the organization**. It does not mean an external source, ministry, or Qatar national statistics office has certified the numbers.

## Deployment requirements

1. Back up the hosted Supabase database, review the SQL, and apply **00040 after 00039**. No migration is applied automatically through GitHub.
2. Confirm your application server has `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` in server-side environment configuration. The service-role key must NEVER be exposed in the browser or committed.
3. Ensure **two different active users** in the organization: one with `supply.edit`, a reviewer with `decisions.approve`. Some existing roles do not carry review permission by design.
4. Open Food Security → Commodities → select a commodity → Supply & Demand Balance → Source data & independent review. In DEMO mode no source intake is displayed.
5. Enter an **end-of-day usable stock snapshot for the day preceding** the balance start date. Both date and stock are required.
6. Submit one or more source-backed production, confirmed import, consumption and loss movements with stable, unique source movement keys.
7. Declare complete date coverage separately for all four flow types over the requested horizon. If the source cannot attest to a complete interval, select **partial**.
8. A different authorized reviewer checks the underlying source and enters a meaningful review note before verifying or rejecting each record.
9. Refresh the Food Balance view. Missing reviewed stock or complete coverage still results in `insufficient_data`, never a fictional zero.

### Examples of appropriate provenance references

- `warehouse:stocktake:2026-11-01`
- `shipment:customs:consignment-12345`
- `farm:harvest:field-12:2026-11-07`
- `demand:forecast:report-2026-11`

Examples here are reference **formats only**, not existing Qatar records.

## Important limitations

- No direct customs, ministry, retailer, warehouse-system or external provider API connectors are configured by this change.
- Manual entry does not itself establish source credibility; reviewers must check the underlying document or telemetry.
- The model uses aggregate **metric tonnes**. Milk conversion from liters, water content, grade, shelf life, losses and edible-equivalent factors require future commodity-specific conversion rules.
- Import quantities are allowed only for **confirmed imports**; speculative shipments must not be recorded under this category.
- A projection is not a daily physical stockout model. Current sensitivity simulation remains an aggregate what-if preview.
- No cross-organizational national aggregation is enabled; that requires explicit legally authorized data-sharing and normalization.
- Inventory snapshots and source records are immutable. Corrections, reversals and re-attestation require a future audited correction mechanism; do **not** delete records manually.
- The display only includes the 40 most recent records of each type. The balance calculation reads up to 1,000 verified flow and coverage records each, and fails closed rather than silently truncating.
- Database triggers/RLS must be tested against a staging Supabase instance before government production use.

## Verification checklist

- `npm run lint`
- `npm test`
- `npx tsc --noEmit`
- `npm run build`
- Signed-out API call returns 401; a member without the required permission returns 403.
- Source cross-tenant GET/POST/review returns 403 or 404 and does not expose records.
- Duplicate external movement key returns 409.
- A pending source has **no effect** on live balance.
- A reviewer cannot review their own source.
- Verified source appears in a balance, rejected source never does.
- SQL activity ledger contains one submit and one review event per reviewed record.

## Next planned work

Versioned organization data source registry; CSV and typed external API adapters; automated reconciliation, correction/reversal workflows, data source freshness, reviewer evidence links, and approved national federation.
