# NFII Procurement: Global supplier research and sourcing intelligence

## What is implemented

Existing page: \`/dashboard/procurement\`, integrated with the existing
\`NfiiOperationsWorkspace\`. No new Supabase tables, RLS changes or database
migrations. Search is **explicitly requested** by the operator; the browser
does not run paid/remote API searches on initial page load.

Three external data providers:

| Source | Scope | Authentication / cost | Evidence it provides | Does NOT prove |
|---|---|---|---|---|
| GLEIF Global LEI Index | Global legal-entity names, LEI, country, address, entity and LEI registration status | Public API, no key | Legal entity and identifier status | Commodity supply, export licences, food safety, prices, ability to deliver |
| Google Places (New), Text Search | Worldwide food-business search with company listings, mapped addresses, website and phone when exposed | Optional **server-side** Google Places API key and billing; organization capability required | Search leads and contacts subject to Google policies | Formal supplier KYB, verified legal name, product range, origin certificates, pricing or quotations |
| UN Comtrade public preview | Qatar annual merchandise imports by product HS code and partner country | Public preview API, no key; request limits and a max 500 rows | Historical sourcing **countries** and reported trade value in USD | A list of suppliers, real-time freight, customer/contract prices, 2026 active shipments, guaranteed completeness |

**Provider documentation:**
- GLEIF: https://www.gleif.org/en/lei-data/gleif-api/
- Google Places: https://developers.google.com/maps/documentation/places/web-service/text-search
- UN Comtrade: https://uncomtrade.org/docs/un-comtrade-api/
- UN Comtrade fair usage: https://uncomtrade.org/docs/policy-on-comtrade-data-use/

## Operation

In **Procurement control → Supplier discovery & sourcing intelligence**:

1. Select **Company registry** and search for a company name or a name keyword.
   Optionally filter by ISO 3166-1 alpha-2 country. The LEI legal status and
   registration state are displayed separately. Entity ACTIVE + LEI ISSUED
   does **not** make an agricultural supplier or import/export license.
2. Select **Qatar import origins**, a commodity in the existing NFII catalog
   and a historical year (2022-2025). The result ranks reported partner
   countries in USD using the official public preview. A click on **Search
   country entities** prepares a targeted *GLEIF* legal-name lookup and
   country filter; it does not invent company names.
3. Optionally select **Business discovery** for Google Places text search,
   query by product/business type and bias toward a country. **Country bias is
   not a strict filter**. Business listings are view-only; source names and
   contact details are subject to Google's terms.
4. Add suitable candidates to the **temporary in-browser shortlist**,
   compare original evidence URLs and copy the shortlist for external
   verification. No emails are sent, no suppliers created automatically.
5. For GLEIF entities only, if the user has an authorized organization with
   \`supply.edit\` and the operational ledger is live, press
   **Prepare supplier draft**. This only prefills the existing supplier form
   (source LEI in \`code\`, legal name and legal-address ISO country).
   The user manually checks the data and explicitly submits through the
   **existing** \`POST /api/nfii/operations\` endpoint.
6. The existing supplier record is initially **pending**. Independent
   approval through the existing operational approval RPC is mandatory;
   contract and purchase order workflows remain unchanged. **No imported
   provider record is automatically approved**.
7. Google Places listings are not automatically transferred to a persistent
   supplier record; do independent legal-entity research first and manually
   onboard using evidence obtained under an appropriate licence.

## Deployment and configuration

**Free first:** GLEIF and the UN Comtrade public preview need no API key.
Both require an authenticated NFII session, while requesting data for a
specific organization is also checked against \`supply.view\`.

**Optional commercial business search:** On the NFII server environment,
configure \`GOOGLE_PLACES_API_KEY\` as a secret and enable **Places API (New)**
in a Google Cloud project with billing and appropriate API key restrictions.
Do NOT put this in a NEXT_PUBLIC variable or in GitHub. Text Search New
requests with website and international phone fields incur applicable Google
Places Enterprise SKU billing. The app never exposes the key to the browser.
Queries to the paid provider are gated by \`supply.view\` on an authorized
organization. If the key is not configured, the UI returns a clear 503
diagnostic rather than pretending search succeeded.

**Production operations:** The existing \`00041_nfii_operational_supply_chain.sql\`
migration must have been applied *for persistent supplier onboarding*.
An empty or unconfigured ledger still permits signed-in users to query the
free external research API. Discovery results do not require running the
previous Qatar sandbox seed SQL, and do not merge into Food Balance KPIs.

**Scaling:** The API uses bounded (12-18 item) result views, hard-coded
approved upstream hosts, 12-second timeouts, input validation and Next fetch
caching for public sources. Production organizations expecting sustained
search volumes should add a centrally enforced per-user quota and quota
dashboard, particularly for paid Google requests. Provider upstream 429,
outage, empty datasets and unexpected shapes yield explicit messages.
Neither old synthetic supplier records nor fabricated trade rows are used
as a fallback.

## HS classification limits

This feature uses existing nine commodity IDs and representative HS headings:
\`tomato 0702\`, \`cucumber 0707\`, \`pepper 070960\`,
\`lettuce 0705\`, \`date 080410\`, \`barley 1003\`,
\`milk 0401\`, \`rice 1006\`, \`wheat 1001\`.

Codes \`0705\` and \`0401\` include products broader than lettuce/milk
in everyday language; fresh pepper code includes Capsicum/Pimenta.
The selected HS year is a **reporting period**, not a current supplier
availability date. Data reporting can lag. Preview partner rankings
exclude non-Qatar, different commodity and double-counted partner2/customs/
transport subtotals, but the preview may still be truncated or missing.
Bars compare visible partners relative to the largest visible partner; they
do not assert shares of *all* Qatar imports unless a complete world total
was separately provided. The UI preserves USD for trade figures rather than
treating them as per-tonne contract quotes.

## Safety and compliance

- Global API credentials never leave the server. No user-entered URL can
  direct server-side requests to an arbitrary host (SSRF protection).
- The server requires a logged-in user. An \`organizationId\` always triggers
  active \`supply.view\` authorization; the paid provider requires it.
- The public results carry explicit source and provenance; failure returns
  an error, not a synthetic record.
- A legal entity LEI, a business listing, and a national trade statistic are
  three different evidence classes and are never conflated.
- Legal, sanctions, beneficial ownership, food safety (HACCP/ISO 22000),
  country-specific import permits, logistics lead time, halal compliance where
  relevant, bank verification and bid/quotation verification are **not**
  claimed by this prototype.
- Only the existing audited and independently authorized application flow can
  persist an NFII supplier; no automated RFQ, purchase or shipment command.

## Tests

Pure provider parser and validation tests cover LEI, Google Places, Comtrade,
ISO 3→2 partner normalization, duplicate partners, missing and truncated data,
unsafe URLs, fixed host/parameter policy, and strict supplier qualification.
Static regressions verify the existing scoped, audited supplier workflow and
the absence of direct Supabase mutations by the global discovery route.


## Guided Procurement experience

**Procurement now starts on Overview**, not with every registry, global search,
approval inbox, creation form and audit ledger visible simultaneously. There
are six focused tabs:

| Tab | Purpose | What appears |
|---|---|---|
| Overview | Understand the approved purchase workflow | Four key indicators, 5-stage journey, recommended next step |
| Find suppliers | Research sourcing opportunities | GLEIF, Google Places (optional), UN Comtrade, candidate shortlist |
| Suppliers | Qualify and register legal counterparties | Supplier-only register, status/search filters and the supplier form |
| Contracts | Negotiate and record agreed supply | Contract-only register and terms form; requires approved supplier |
| Orders | Raise controlled purchase commitments | Purchase-order register and order form; requires approved valid contract |
| Approvals | Independent second-person review | Relevant supplier/contract/order approval queue and review actions |

The **existing API authorization, immutable audit and independent review
system remain unchanged**. No migrations and no new permissions were added.
The internal audit event panel remains available on Logistics/Reserves but is
not shown all over the Procurement workspace.

**First live record fix:** The original UI automatically opened an illustrative
Qatar dataset when the live organization had no rows, which left users unable
to create their first supplier. The new Live data toggle is enabled when the
authorized organization ledger has loaded successfully, **including when it
is empty**. Explicitly switching to Live permits the first supplier creation
if the user has \`supply.edit\`. The Example view remains strictly read-only.

When users prepare a GLEIF supplier draft from the Find suppliers screen,
the workflow switches to the Supplier tab, opens the existing registration
form with prefilled legal identity, and requires an explicit submission.
Contracts and Orders show a clear prerequisite explanation and link to the
previous tab if no approved parent record is eligible; creation remains
disabled until the prerequisite is met.

Every stage offers its own local search and status filter. Audit logs and
unrelated modules do not crowd the current task. Headings and guidance are
available in English and Arabic, retaining the Growa palette and components.


## Crop-first supplier discovery (2026-11)

**Primary user question:** "I need wheat / rice / tomatoes: which named
organizations have reliable product-level evidence?" A company-name match
in GLEIF, a generic Google listing or a Qatar import-country record does not
answer it. Procurement > Find suppliers now opens a **crop-first source
section** before the older corporate identity and trade-market tools.

The crop-first endpoint
\`GET /api/nfii/procurement/crop-producers?commodity=rice&country=IN\`
returns a clearly labeled **limited snapshot of real entries** transcribed
from the publicly published [FairTSA certified-products directory]
(https://www.fairtsa.org/products), consulted 2026-11-01. It does not pretend
to be FairTSA's live API and does not fetch real-time certificate status.

Each product-to-organization match exposes:
- Listed organization and **exact matching product** (e.g. non-Basmati
  rice paddy is retained as paddy, not magically finished rice).
- Country, the listed certification body, producer ID and original FairTSA URL.
- Explicit booleans showing **own-crop cultivation NOT independently proved**,
  **certificate currently active NOT checked**, export qualification NOT
  checked, commercially available stock UNKNOWN and supplier NOT approved.
- An in-browser research shortlist with attribution; no Supplier table writes.

**Published-source coverage is limited, not global:** 6 rice entries,
3 barley, 2 wheat, 1 tomato, 1 milk; zero matches in this particular excerpt
for cucumber, lettuce, dates or Capsicum pepper. A FairTSA entry labelled
"Pepper" could refer to the spice, so it is intentionally **not** mapped to
bell pepper. Other sources and other producers exist outside the excerpt.
Multiple crops may map to the *same* organization (counts are not independent
businesses). Records and spelling are tied to FairTSA's public published
directory and need rechecking; **there is no claim the 2026 certificate is
currently active**.

The UI provides links to the authoritative
[USDA Organic INTEGRITY Database](https://organic.ams.usda.gov/integrity/)
(for certified product and CROPS scope search) and
[GLOBALG.A.P. IT Platform](https://globalgap.org/what-we-offer/globalgap-it-platform/)
(for product/producer and certificate verification). **They are external
verification links, not connected search APIs in this delivery.** USDA
certified operations can be agricultural producers OR handlers; GLOBALG.A.P.
API needs a direct agreement/subscription. Neither is a universal registry
of farms worldwide or guarantees commercial capacity.

**Additional research** is moved into a collapsed panel. Existing GLEIF
legal-name search, Google Places listing search and UN Comtrade import origins
are still available but are explicitly described as supplementary, *not*
proof that the entity itself grows a particular commodity.

### Data-quality and authorization gates

- The endpoint uses the existing authenticated session, validates crop and
  country, and applies \`supply.view\` if a tenant is specified.
- No new Supabase tables, migrations, credentials or permissions.
- No raw upstream URL is accepted, no crawler/scraper or unauthenticated paid
  API calls are used, and no fake producer is returned as a fallback.
- Records have human-readable provenance and are not automatically transformed
  into approved suppliers. To onboard, independently establish an entity's
  identity, growing role, current certification, licenses, export capacity,
  actual quantities and delivery capability.
- Tests verify crop-specific matches, explicit non-coverage, country filters,
  ambiguous pepper exclusion, non-certified status claims, auth and no writes.

### Remaining work for production-scale coverage

A **comprehensive crop → producer search across countries** requires a
licensed source with a crop-by-site dataset, or an ingestion pipeline for
USDA Organic INTEGRITY's official monthly export and, where licensed,
GLOBALG.A.P.'s product/certificate API. Neither source is currently connected
to the NFII server in this change; the 9-entry FairTSA extract is a narrow
working example of **sourced names**, not a global farmer discovery service.
An official open-API key and a current ingest dataset must be provisioned and
verified before a service can honestly claim "live worldwide verified
producers" in the UI.
