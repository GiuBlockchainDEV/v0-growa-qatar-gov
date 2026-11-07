# Growa Qatar: free public commodity price evidence

## What is live and what is not
There is no paid provider and no API key in this implementation. The Watchtower
Commodity Markets terminal and the selected-commodity Intelligence workspace
use the same authenticated backend data API.

- **World Bank Pink Sheet**: official public XLSX "Monthly Prices" workbook;
  updated when the Bank publishes a new monthly observation. A server-only,
  bounded ZIP/XML reader extracts verified values, units, and observation months.
- **IMF Primary Commodity Prices via public FRED**: fallback and independent
  monthly source. The newer published month wins; World Bank wins a tie.
- **USDA AMS public Market News**: links to four monitored grain bid reports
  with publication dates. Actual bid values remain inside the public reports,
  and are deliberately **not** claimed as automated numeric quotations.
- **USD/QAR**: fixed official parity 3.64. Unit conversion is applied only
  when the workbook explicitly identifies USD per metric tonne or USD per kg.
  No assumptions are made for incompatible price units.

No evidence is synthesized or future-dated. Monthly commodity benchmarks are
not exchange real-time ticks, Qatar import transaction values, supplier offers,
farm-gate quotes or FOB/CIF-equivalent offers. USDA U.S. cash bids are not
substituted into World Bank benchmarks because their locations, grades and
delivery bases differ.

## Provider URLs

- World Bank: https://www.worldbank.org/en/research/commodity-markets
- World Bank XLSX:
  https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx
- FRED public monthly CSV: https://fred.stlouisfed.org/graph/fredgraph.csv?id=PWHEAMTUSDM
- USDA state grain reports: https://www.ams.usda.gov/market-news/state-grain-reports
- USDA report metadata: https://mymarketnews.ams.usda.gov/viewReport/3147

The reports URL can have intermittent upstream availability. An unreachable
USDA site yields an "unavailable" report state but does not prevent loading
monthly price benchmarks. The same applies if World Bank's document location
changes. Price provenance, observation period and provider status remain
explicit so stale values never masquerade as fresh quotes.

## Deployment

No new Vercel secrets. Server-only fetching runs through
`GET /api/watchtower/commodity-markets` after Supabase user authentication.
Each source is independently time-limited, source data and ZIP members are
bounded, successful monthly data is cached for six hours and USDA report status
for four hours. Failure is cached for 10 minutes to reduce repeated requests.

Data licensing and attribution requirements of USDA, World Bank, IMF and FRED
still apply to any downstream distribution.

## Verification

Focused CI validates TypeScript, parser/unit/observation-date tests,
authentication and provenance, page wiring and a Next.js production build.

**Known limitation:** Numeric USDA cash bids are NOT automatically parsed from
their PDF source reports. Before enabling these as numerical bid feeds, add a
tested, independently reviewed structured extractor with quality, basis,
grade, location, bid/ask, date and bushel-to-tonne unit validation.
