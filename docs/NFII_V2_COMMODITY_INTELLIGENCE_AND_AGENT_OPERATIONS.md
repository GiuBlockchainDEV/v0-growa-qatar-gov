# NFII 2.0: Commodity Intelligence and agent operations rehearsal

## Purpose and user problem

The former Commodity Intelligence page mixed commodity-level food balance with legacy
national Watchtower coverage and generic agricultural/IoT summaries. It also
embedded a generic AI analysis which did not explain how specialist agents would
actually collaborate across Procurement, Logistics and Strategic Reserves.

The new information architecture is **one commodity, one time horizon and one
evidence source at a time**, with an explicit distinction between observed
organization records and illustrative Qatar 2026 source assumptions.

## Commodity Intelligence

At \`/dashboard?module=commodities&commodityId=rice\`:

1. Select **commodity** (nine catalogued commodities) and **7/30/90/180-day**
   horizon.
2. Pick **Auto / Live data / Example data**. Auto prefers a *complete*
   independently reviewed balance for the active authorized organization;
   otherwise it shows a clearly tagged illustrative view. Live mode never
   fills missing evidence with simulated quantities.
3. Read four executive indicators: expected end-of-period usable stock,
   period consumption, days of coverage at period end, and deficit. Units
   and interpretation are explained.
4. Inspect the explicit stock arithmetic:
   **opening stock + local production + imports - consumption - loss = net**.
   Negative net produces a deficit; physical usable stock is floored at zero.
5. Review **commodity-specific** linked procurement contracts, approved POs,
   shipment status, usable reserve lots and approved-but-unexecuted release
   commitments. Physical inventory, administrative shipments and contracts
   are **not** added again to the source food balance.
6. Open the **Agent operations simulation** tab or the **Evidence & source
   records** tab. Live source intake and independent review remain available
   there, with the existing permissions and APIs. No new migration is required.

Removed from this page: generic national contract totals, unrelated
Watchtower signals/coverage, unscoped national climate risk, and unrelated
farm-level production/water/energy KPI tiles.

## Qatar examples reused, not reseeded

The **existing** \`supabase/seeds/qatar-2026-sandbox/03_dataset_preview.json\`
is the sole illustrative operational source. \`lib/food-security/demo-data.ts\`
now additionally builds a matching illustrative food balance from the
**same** \`commodity_daily_assumptions_tonnes\` records. For flexible horizon
selection, it expands the assumptions into dated daily flows; it retains
documented Qatar vegetable seasonality from the existing SQL example.

These are read-only objects in the application; **no SQL scripts, organization,
users, records, approvals or migrations are created**. The previous demo
generator remains unchanged for other consumers.

## Operational multi-agent simulator

Visible in **Commodity Intelligence > Agent operations simulation**, and
**Watchtower > Agent operations** (\`#watchtower-agents\`).

The step-by-step browser simulator reuses the existing
\`AGENT_REGISTRY\` specialist identities:

1. **Orchestrator** assigns the commodity scope and horizon.
2. **Data Quality Agent** checks opening stock, all four flow categories and source references.
3. **Food Security Analyst** calculates food supply, demand, projected stock and deficit.
4. **Agronomy Analyst** assesses local-production contribution and explicitly
   reports that farm/satellite source evidence is *not* integrated into this case.
5. **Supply Analyst / Procurement** checks related suppliers, approved contracts and orders.
6. **Supply Analyst / Logistics** reviews linked shipments, planned movements and delay flags.
7. **Compliance Analyst / Reserves** reviews expiry-aware, approved lot inventory
   and approved-but-unexecuted release commitments, without double counting.
8. **Weather Analyst** identifies missing linked weather evidence instead of inventing a forecast.
9. **Watchtower Analyst** runs deterministic stress testing and uses provisional
   7/14/30-day coverage risk bands. (These are **not** official Qatar policy.)
10. **Reporting Agent** drafts a decision brief, followed by a mandatory
    **Human authorization gate**.

The UI shows the existing and proposed data flows with a run/expand action and
a ten-stage activity log. Each stage exposes the agent role, finding, evidence
and attention/blocked state. Available presets are baseline, import disruption,
local-production loss, and compound crisis; four stress sliders can be edited
independently. Numerical shock calculations use the already shipped
\`calculateFoodScenario()\`.

### Human-in-the-loop boundary

All proposals and locally rehearsed approve/reject buttons are **browser-only
simulation**. They do not call the model/LLM, \`/api/ai/missions\`,
\`/api/nfii/operations\`, Supabase privileged RPCs, carrier systems or
external procurement. They do **not** create real contracts, shipments,
evidence approvals, government decisions or reserve releases.

The read-only program demonstrates the *intended operating model* of specialist
agents rather than claiming an actual autonomous multi-agent run. Real tool
execution, policy approvals, missions, audit persistence and external source
integration remain independent future engineering work.

## Validation and safety

- Switching organizations clears stale live API reads and enforces the
  \`organizationId\` returned from authenticated endpoints.
- Auto mode never merges illustrative food balances with real operational
  rows. Real missing information is not interpreted as zero.
- A missing/partial live balance gives **unknown**, not a healthy screening
  score or fabricated shortage.
- Preview row IDs and sourceRefs retain explicit synthetic/test provenance.
- The two example sources are designed for a fictional Qatar food distributor,
  **not certified national reserves, Qatar-wide consumption or import volumes**.
- Programmatic unit tests cover cross-module links, expired lots,
  reservations, realistic 7/30/90/180-day illustrative food calculations,
  deficit risk under combined shocks, incomplete evidence, approval gating
  and the new information architecture.
- GitHub CI validates ESLint, Vitest, TypeScript and Next.js build.
- Real-browser visual and Supabase-backed staging acceptance tests remain
  necessary before a production rollout.


## Final agent recommendation: only after running the agent sequence

The simulator computes the deterministic analysis **only when the operator
presses Run agent sequence**. It does not generate or display the agent result
during initial page rendering or when simply selecting scenario inputs.

The ten-stage progress is revealed in order. **Only after all ten stages
finish** does `CommodityAgentVerdict` appear above the activity log, with
the consolidated outcome computed through `lib/nfii/agent-decision.ts`.

- Before Run: no numeric scenario results, agent proposals or final verdict.
- During Run: activity log and progress, with conclusions withheld.
- After completion: executive verdict, scenario metrics, proposals and a
  simulated human approval gate; no real action is executed.
- Complete active simulation: optional fast-forward enabled **only after**
  Run has started; never exposes a conclusion before initiation.
- Scenario/shock/commodity/source changes invalidate the previous run
  immediately; a new Run is required for a new conclusion.
- Reset clears the run and restores baseline assumptions.

The engine remains a deterministic **read-only rehearsal**, not an LLM agent
or a real procurement or stock movement.
The executive summary explicitly separates:

- **Action to evaluate**: evidence collection, investigation of a scenario
  deficit, accelerated replenishment review, monitored replenishment timing,
  or continued monitoring without an additional purchase recommendation.
- **Why**: risk and quantified period-level scenario assumptions.
- **Quantity to investigate**: the modeled deficit (metric tonnes), **never
  represented as an approved order quantity**.
- **Next operational step** and **reviewer accountable** for authorization.
- **Alternatives to verify**, not automatically selected suppliers.
- **Secondary issues** such as delayed shipments and reviews outstanding.
- **Human authorization and execution**: permanently disclose that there is
  **no real approval, procurement order, logistics dispatch, or reserve
  release**. The browser's approve/reject rehearsal changes only local UI
  state and cannot perform an operational action.
- **Data source**: illustrative Qatar values versus organization-scoped
  reviewed balance, clearly marked.

Concrete example using existing Qatar seed assumptions for a 30-day tomato
scenario with a 40% production reduction, 65% import shortfall, 20% increased
demand and 10% opening-stock loss: the simulation reports a **53.2 t modeled
shortage to investigate**. This is not a purchase recommendation of exactly
53.2 tonnes and does not account for day-level stockouts, supplier capacity or
pricing. The proposed response is to verify available supplier contracts,
shipment ETAs and usable lots, then submit evidence for independent review.

For **incomplete real source data**, the verdict becomes **blocked / request
evidence** with no manufactured shortage quantity. For sufficient modelled
coverage, the result is **continue monitoring**, not automatically purchase
or certify food security. These distinctions are enforced in unit tests.

This is a transparent, deterministic recommendation engine that **simulates**
specialist coordination; it is not a real multi-agent LLM execution service.


## Visual charts (Growa design system, no new dependencies)

All visuals read **existing NFII model output**. No API endpoints, tables, data
imports or chart library were added. The visual palette uses
\`--growa-ink\`, \`--growa-sage\`, warm-stone/cream neutrals and the existing
critical status token. Charts have descriptive accessible labels and nearby
text totals, including Arabic labels.

**Commodity Intelligence → Situation & supply chain:**
- **Supply vs consumption**: two stacked bars at one shared scale. Available
  opening stock + local production + imports versus consumption + expected
  losses. Segments display the exact reported quantities in metric tonnes.
- **Accounting waterfall**: opening stock → production → imports → consumption
  → losses → net, including negative balances. This is not a daily stock
  trace, and a negative modeled balance remains separate from usable stock.
- When a source is incomplete, do not chart it as zero. The empty-state
  explanation directs users to the missing evidence.
- Operational shipment, contract and reserve quantities are *not* added to
  the food-balance charts, preventing reconciliation mistakes.

**Agent operations (both Commodity Intelligence and Watchtower):**
- After **Run agent sequence**, a segmented **10-stage progress chart**
  shows completed specialist steps. It never displays final conclusions or
  risk quantities while the run is in progress.
- Only after all steps finish, display the executive verdict and two
  side-by-side charts:
  - **Baseline vs disrupted net food balance**: diverging horizontal bars,
    with zero clearly marked, to distinguish stock surplus from shortages.
  - **Baseline vs disrupted days of coverage**: aligned bullet bars. A
    dashed 30-day reference is explicitly illustrative, **not** a Qatar
    government reserve standard.
- Editing shock sliders or choosing another commodity, horizon or data source
  invalidates the previous run, removing the prior chart and recommendation
  until a new run completes.
- Figures remain illustrative for the Qatar demo; a real organization-backed
  source is clearly distinguished. No purchase, stock release or approval
  is triggered.

Automated tests validate chart arithmetic (including negative balances),
source completeness, matching commodity/period/scenario identity, progress
bounds, and the post-completion visibility guards. Visual browser QA in the
deployed environment remains a separate acceptance step.
