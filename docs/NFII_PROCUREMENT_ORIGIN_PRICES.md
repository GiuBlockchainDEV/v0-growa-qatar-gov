# NFII Procurement: feasible origins and historical QAR/kg pricing

## What changed

The primary **Find suppliers** flow now begins with a commodity-level trade
intelligence panel. It retrieves available annual Qatar import observations
from UN Comtrade and suggests **relevant origins**, rather than offering the
user all 249 ISO countries irrespective of farm production or trade history.

The selected origin is then passed to the existing crop producer discovery.
Qatar appears as an **unpriced local sourcing option** only for crops with
documented domestic candidate businesses.

## Source and calculations

API: \`GET /api/nfii/procurement/origin-prices?commodity=tomato&year=2025\`

The endpoint:
1. Requires a signed-in NFII user; optional \`organizationId\` is validated
   and \`supply.view\` is enforced.
2. Requests annual Comtrade **Qatar imports** for the commodity's existing
   declared HS code for 2025, 2024 and 2023 (or an earlier selected year),
   bounded to the upstream Comtrade host, with timeouts and daily caching.
3. Rejects rows with mismatched reporter, period, HS code, flow, partner2,
   customs or transport subdivisions; world totals and missing/zero net
   weights cannot become a price. Duplicate partner subtotals are never summed.
4. Uses the latest year with any meaningful observed trade and screens
   country-level lanes by a minimum of **US$10,000** and minimum annual tonnes:
   **10t** for greenhouse/fresh vegetable groups, **20t** for dates/milk,
   **1,000t** for barley/rice/wheat. These thresholds are product-neutral
   operational heuristics, not proof that a country can fill any specific RFQ.
5. Examines the 12 largest eligible import-volume lanes and sorts them by
   observed unit value. **All** eligible country lanes contribute to the
   overall weighted mean, not just those 12 plotted.
6. Converts imported annual value to QAR using the fixed 3.64 QAR/USD peg.

**Historical country-level unit value:**

\`unit_value_QAR_per_kg = Qatar_import_value_USD × 3.64 / net_import_weight_kg\`

**Eligible-country weighted mean:**

\`weighted_mean_QAR_per_kg = Σ eligible import values_USD × 3.64 / Σ eligible weights_kg\`

The comparison is an **observed historical customs value**. For imports, the
valuation typically reflects CIF-like costs depending on reporting practices.
It is **NOT** a farm-gate quote, producer offer, current retail price,
shipping quotation, or delivered proposal under a specific Incoterm.

Data can be absent, delayed or different across products captured by the
same HS heading. The UI uses **N/A** rather than manufactured numbers if the
provider is unavailable or the screened trade observation is insufficient.
The year is always shown, and historical-price ranking is never portrayed
as the best current purchase order without further checks.

## Selection logic

The user can choose:
- **Observed Qatar trade origins** (country and commodity recorded in Qatar's
  past imports at meaningful value/weight), ordered by historical QAR/kg.
- **Documented company countries** (named entities previously evidenced
  as growing, marketing or supplying the commodity, but no comparable Qatar
  customs price is in the screened report); these are **unpriced**.
- **Qatar local** when documentary evidence of local businesses for the
  selected crop exists; it is **not** assigned an import tariff unit price.

Previously available free mapped crop location searches and opt-in paid Google
Places business searches continue working after an origin is selected.

## Dashboard

The crop panel shows:
- Weighted historical mean and lowest observed price (**QAR/kg**).
- A **historical price by origin** comparison bar chart.
- A **Qatar import tonnes by origin** bar chart.
- Country table with difference from mean, observed import volume and
  prior-year presence.
- A suggested first country for **RFQ investigation**, selected on lowest
  screened historical unit value, clearly flagged as not a live quote.
- Named but unpriced country leads, with a link into the crop-search form.

No supplier, farm location or quote is automatically approved or persisted.

## Limitations and next stage

For a real purchase decision, collect supplier RFQs, delivery Incoterms,
certificates, supplier capacity, MOQ, transport and customs estimates,
shelf life, crop seasonality and phytosanitary restrictions. Only then should
NFII compare **landed QAR/kg** and commercial feasibility.

UN Comtrade import partner data shows observed trading partners, not
necessarily where plants were cultivated; re-exports and mixed HS products
require origin-of-production verification. The lowest customs unit value
can simply reflect a different variety, packaging or grade.

Data sources:
- UN Comtrade public API: https://comtradeapi.un.org/public/v1/preview/C/A/HS
- UN Comtrade trade-statistics metadata: https://comtradeapi.un.org/public/v1/preview/C/A/HS
- Qatar Central Bank exchange rate/parity:
  https://www.qcb.gov.qa/en/Pages/MonetaryPolicyTools.aspx
