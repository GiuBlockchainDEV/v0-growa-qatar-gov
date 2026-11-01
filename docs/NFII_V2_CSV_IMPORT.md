# NFII v2: transactional CSV source ingestion

## Status and data boundaries

This is the first batch-ingestion adapter built on migration 00040. No new migration is required.

- Existing commodity balance calculations are **organization-scoped**, not national.
- Every imported record is assigned \`source_kind='csv'\`, the authenticated submitter, and \`verification_status='pending_review'\`. The CSV cannot supply tenant IDs, reviewer details, verification status, audit fields or database primary keys.
- Files are validated server-side and previewed before committing.
- Each CSV contains **one commodity and one record kind**, selected in the UI. The selected organization and commodity are enforced by the server.
- Only users with \`supply.edit\` may preview and submit.
- All records are inserted in one PostgREST SQL statement; a unique-key violation rejects the entire batch. The existing PostgreSQL audit triggers from migration 00040 create per-row submission events.
- Only a different user with \`decisions.approve\` can verify the source, after which the existing balance API can include it.

## CSV templates (headers only)

Stock snapshot: \`sourceRef,dataMode,asOfDate,usableTonnes\`

Flow: \`sourceRef,dataMode,externalKey,flowType,effectiveDate,quantityTonnes\`

Coverage: \`sourceRef,dataMode,flowType,startDate,endDate,status\`

Dates use ISO \`YYYY-MM-DD\`. Quantities are in **metric tonnes**, with up to three decimal places. Never send commas for thousands separators.

Allowed flow types: \`domestic_production\`, \`confirmed_import\`, \`consumption\`, \`loss\`.

Allowed data modes: \`observed\`, \`estimated\`, \`forecast\`. Stock accepts only observed or estimated. Coverage status must be \`complete\` or \`partial\`.

\`sourceRef\` must identify actual evidence from the owning organization (for example a document ID, dispatch manifest or telemetered observation reference). \`externalKey\` must uniquely and stably identify each movement in that organization. Do not create a new external key to replay an existing event.

### Import procedure

1. Open the Commodity Intelligence workspace and select a commodity in LIVE mode.
2. Expand **Source data & independent review**.
3. Download a template corresponding to stock, flow or coverage records.
4. Fill the CSV with documented real-world values. Do not copy DEMO values into an operational CSV.
5. Choose the CSV file and click **Validate & preview**.
6. Check record count, provenance and sample. Invalid or duplicate records block the entire batch.
7. Click **Import all as pending review**. Do not navigate away during the request.
8. Have a separate authorized reviewer inspect underlying evidence before verifying each record.
9. Reload the Supply & Demand Balance. Incomplete verified coverage still yields \`insufficient_data\`.

### Operational limits

- 200 records per CSV; 256 KiB maximum.
- No background jobs, automated email, third-party credential or external API connector in this slice.
- Existing uniqueness constraints protect source identities; there is no automatic replay/upsert.
- A complete coverage declaration is an assertion requiring independent validation, **not** a proof that all production or imports have been received.
- CSV is not directly downloadable as an original file after ingestion. Per-row source references, submission time and review events are retained.
- Corrections/reversals for immutable records require a separate reconciliation workflow.
- No formula-driven CSV or Excel execution is performed; records are treated as text and checked before insert.
- The batch import uses one SQL transaction per CSV, but parallel uploads may conflict. PostgreSQL uniqueness remains final.

## Verification

Run \`npm ci\`, \`npm run lint\`, \`npm test\`, \`npx tsc --noEmit\`, \`npm run build\`.

On an isolated staging database with migrations 00039/00040 applied, test:
- Cross-tenant upload fails with 403.
- User lacking \`supply.edit\` cannot preview or commit.
- A malformed CSV does not insert anything.
- A CSV with duplicate \`externalKey\` does not insert partial records.
- A file with two valid flow records inserts exactly two pending rows, with two immutable submission events.
- Records from the batch do not affect Food Balance until independently reviewed.
- The source submitter cannot verify the rows.
- A second appropriately authorized user can verify and the balance reflects only verified records.

Automated API integration with a deployed Supabase environment remains a separate verification task.
