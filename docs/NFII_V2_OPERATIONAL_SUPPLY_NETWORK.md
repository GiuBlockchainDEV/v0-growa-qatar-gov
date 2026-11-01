# NFII 2.0 | Operational Supply Network: Procurement, Logistics, Strategic Reserves

**Status:** Code and migration authored. Real workflows require applying \`00041_nfii_operational_supply_chain.sql\` to the correct Supabase environment. No synthetic ICPS reference records are seeded.

## Product design

The ICPS demonstration inspires an integrated, dark command interface, with one logical process:

\`Approved supplier → Approved contract → Approved purchase order → Shipment → Delivered shipment → Approved warehouse/received lot → Approved reserve release → Recorded execution\`

The system is **organization-scoped**, not an authorized national federation. The implementation creates and tracks **actual persistent NFII database records and human approval decisions**, not external bank payments, real-world vendor purchase orders, bills of lading automatically verified by a carrier, warehouse actuator instructions, customs confirmations, or stock adjustments in the independently reviewed Food Balance.

### User-facing pages

- \`/dashboard?module=watchtower\`: Food Security + Procurement Risk + Actual Operations Pulse + Scenario Room.
- \`/dashboard/procurement\`: supplier qualification, contracts priced in QAR per metric tonne, purchase orders, approval inbox and audit.
- \`/dashboard/logistics\`: shipment lifecycle tied to approved purchase orders; transport status recorded by authorized users with an explanatory note.
- \`/dashboard/reserves\`: approved warehouses, physically received lots linked to delivered shipments, lot expiry and authorized releases. Reserve availability differentiates physical quantity from approved-but-unexecuted reservations.
- All four pages use the **existing Growa design system**, not the ICPS demo's dark palette: warm stone page backgrounds, white cards, Growa ink (#111E13), cream (#EEF4C9), sage (#6C8952), brand pill controls and Growa's shared PageHeader. English/Arabic labels and cross-module navigation remain available.

## Mandatory deployment steps

1. **Back up hosted Supabase** and read \`supabase/migrations/00041_nfii_operational_supply_chain.sql\` before execution.
2. Apply migration **00041**, after previously applied \`00039\` and \`00040\`. There are no demo rows.
3. Ensure \`NEXT_PUBLIC_SUPABASE_URL\` and **server-side only** \`SUPABASE_SERVICE_ROLE_KEY\` are configured on the deployed Next.js server. Never copy the service key into frontend or source control.
4. Use real active users in \`user_organization_members\`. A session admin preview/impersonation does **not** grant an operational membership.
5. Assign \`supply.view\` to readers, \`supply.edit\` to writers, \`decisions.propose\` to reserve-release proposers, \`decisions.approve\` to distinct reviewers and \`decisions.execute\` to authorized dispatch/release officers.
6. Deploy the exact GitHub commit that contains the migration and the API routes, not an older preview deployment.

## First end-to-end workflow

1. In Procurement, **create a supplier**, giving a unique supplier code and legal name. It enters \`pending\`.
2. Have a different authorized reviewer open **Approvals**, add a supporting note, and approve the supplier.
3. Create and approve a **contract** linked to this supplier, specifying commodity, maximum tonnage, price in QAR/t, and validity period.
4. Create a **purchase order** against the approved contract and independently approve it. The database serializes checks and refuses cumulative approved orders exceeding the contract tonnage.
5. In Logistics, create a **shipment** referencing the approved order, with reference/BL, quantity, origin, destination and ETA. The database prevents active shipment totals from exceeding the approved order quantity.
6. An authorized officer documents the transition \`planned → in_transit → delivered\`, or records \`delayed/cancelled\`. These are manually attested **administrative states**, not automated carrier proof.
7. In Reserves, register and approve a **warehouse**, then create a **lot** from the delivered shipment, including lot reference, received quantity and expiry date. The database prevents cumulative received lots from exceeding the shipment quantity. A different reviewer approves the lot before its quantity is counted usable.
8. Submit a **reserve-release request**, review and approve it with another authorized account, then record execution with a different authorized officer. All actions generate events; released quantity is deducted atomically. Overselling and expired lots are blocked.

### Approval and audit guarantees

- Only the Next.js API calls privileged RPCs, **after** server-side \`requireCapability\` checks against the specific organization.
- RPC execution is granted only to Supabase \`service_role\`.
- Every RPC checks an active, direct organization membership.
- A proposer **cannot approve/reject their own entry**.
- For reserve releases, the proposer **cannot record execution**.
- Approved PO quantities are bounded by the parent contract, shipments by the parent PO, lot receipts by the delivered shipment, and reserve releases by approved lot capacity.
- Parent records use composite \`(organization_id,id)\` foreign keys to prevent cross-organization link spoofing.
- Client-supplied \`status\`, \`reviewed_by\`, \`executed_at\`, \`created_by\`, or arbitrary SQL fields are rejected by the validation allowlist.
- All create, approve/reject, shipment-transition and physical-release recording operations write an **append-only operational event**, in the same SQL transaction. Direct authenticated table writes are revoked.
- Approved reserve inventory is not silently added to \`food_balance_stock_snapshots\`, preventing double counting against other independent sources. Reconciliation is an explicit future workflow.

### Important limits

- There is **no banking, procurement portal, carrier, customs, port, WMS, ERP or national ministry API connection** in this release.
- Contract prices support **QAR/t only**. Currency conversion, bids, price comparison and landed cost need future modules.
- Physical receipt quantity is recorded from human-reported documents, not weighed automatically. Reviewer responsibility remains.
- There is no revision/amendment of an approved contract or PO; create new references for actual distinct agreements.
- Audit records store IDs, event type, actor and supporting notes. Long-term digital signature or external evidence attachment integration is pending.
- Expired lots are excluded from the displayed available stock and blocked from new release requests/execution.
- List endpoints show at most **150 rows per table**. They return \`limits.truncated\` to warn of incomplete summary totals.
- The physical inventory ledger and reviewed food balances are **different datasets**. Live national aggregation requires authorized federation, identity deduplication and reconciled provenance.
- UI form inputs are not a substitute for signed documents, carrier confirmations, legal contracts or fiscal authorization.

## Verification before treating as production-ready

GitHub CI runs ESLint, Vitest unit tests, \`tsc --noEmit\` and Next.js build. In addition, apply 00041 on **staging Supabase** and verify:

- Unauthenticated GET/POST returns 401; a non-member or wrong-tenant query returns 403.
- Active view-only user can read but cannot create/approve/execute.
- Proposer A cannot approve their own supplier, contract, PO, warehouse, lot or release.
- Reviewer B can independently approve after checking supporting documents.
- Contract from another organization cannot be linked to an order.
- Approving two POs concurrently never exceeds contracted capacity.
- Creating shipments concurrently never exceeds approved PO quantity.
- Creating multiple lots concurrently never exceeds delivered shipment quantity.
- Two concurrent reserve approvals/executions cannot oversell the same physical lot.
- Source reference duplicates result in an error, no partial records.
- Audit records are immutable to direct update/delete.
- Reload persists the exact changes, and organization switching clears the previous organization's data.
- Each of the three modules displays clear **empty** state in a new organization, not mock data.
- In all modules, EN/AR copy, focus, contrast, keyboard and narrow viewport behavior are acceptable.

**Do not claim live national authority data, physical dispatch, verified deliveries or completed financial procurement solely on the basis of these records.**


## Watchtower interaction design

The Watchtower uses **three primary tabs**, rather than a long undifferentiated stack:

- **Food situation & risk**: reviewed commodity balances and deterministic procurement-investigation priority.
- **Supply operations**: records and shortcuts for Procurement, Logistics and Strategic Reserves.
- **Scenario room**: read-only disruption sensitivity analysis.

Tabs have explicit active states, keyboard-accessible native buttons and deep-link hashes
(\`#watchtower-food\`, \`#watchtower-operations\`, \`#watchtower-scenarios\`).
The old \`/dashboard/supply-overview\` route redirects to \`#watchtower-operations\`,
rather than rendering demo supply figures.


## UI correction: Growa brand is the design authority

The ICPS reference remains a **functional** inspiration (linked workflows and crisis response), not a visual theme. The prior navy/blue/gold NFII command styling was removed after reviewing the platform's real Growa tokens.

- \`styles/nfii-command.css\` is only a layout layer and uses \`styles/growa/colors.css\` variables, never overriding the platform colors or defining a competing theme.
- Watchtower and Operations use \`PageHeader\` from \`components/brand/layout.tsx\`.
- Three Watchtower sections, Procurement/Logistics/Reserves cross-links, source notices, operational forms, approvals and audit remain functional.
- Risk/error/success states reuse Growa's existing semantic tokens, rather than new blue alerts or off-brand custom colors.
- No database or permission changes in this visual correction.
