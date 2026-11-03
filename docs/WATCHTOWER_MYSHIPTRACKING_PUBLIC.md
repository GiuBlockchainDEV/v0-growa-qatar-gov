# MyShipTracking public HTML GCC radar (opt-in)
This mode follows the user-provided Python Selenium/BeautifulSoup discovery
workflow: inspect public port lists, follow bounded vessel links, retain
source coordinates (even when timestamp or speed is absent), classify vessel types and
source-reported last port / destination. Do not claim a position is live
merely because a page was fetched recently. A voyage/reference route can be
modeled using server-side ocean-network geometry, but is not a sailed AIS
trajectory. Historical tracks need a separate provider with timed fixes.

## Activation / permissions
Set these SERVER variables in Vercel:
- WATCHTOWER_MST_SCRAPE_ENABLED=true

No MYSHIPTRACKING_API_KEY is required for public HTML mode, and no
billable MyShipTracking API request is made when this flag is enabled.
The public website has rights and usage restrictions; enabling automated
collection and redistribution requires the operator to ensure they are
authorized. The system honors access blocks and CAPTCHAs. It does not spoof
human browsers, evade bot detection or use hidden API endpoints. If a
page is inaccessible, show source unavailable rather than fake vessels.

Initial public ports: Jebel Ali, Doha and Ras Laffan. Regional coverage also
includes verified port pages at Fujairah, Sohar, Salalah, Dammam, Al Jubail,
Khalifa Bin Salman (Bahrain), Umm Qasr, Jeddah, Djibouti and Aden. Exact
public URLs and coordinates are maintained in myshiptracking-gcc-shared.ts.
These ports are search entry points, not full-area AIS receiving stations.

Hamad Port is retained as a selectable cartographic hub, but no independently
verified public HTML port URL is wired for it. The tracker will not pretend
Doha and Hamad are identical. Source-page changes can break extraction.

## Cadence
While a user with the server-validated supply.view permission keeps the Watchtower tab visible, the browser polls
GET /api/watchtower/gcc-radar every 300 seconds.
The server caches HTML pages and results for five minutes. It finds up to 12
candidate vessel-page links per source port and scans up to 48 distinct pages
per cycle, prioritizing the original three ports while including every
regional port (at least two candidates when available). Requests run in
bounded groups of ten pages, with 7.5-second source timeouts. There is no permanent server worker or guaranteed five-minute update
when the web page is closed. Last AIS-observed timestamps are shown separately.

If WATCHTOWER_MST_SCRAPE_ENABLED is not explicitly true, the existing optional
licensed API branch remains available only with its own explicit opt-in,
key. The global radar endpoint does not fall back to the paid API.
When public collection is disabled, the UI shows "not configured".

The public-page parser accepts any identified vessel with valid source-backed
coordinates. Vessel classes missing or not identified as cargo remain labelled
unverified, not food cargo. If a ship's source page does not expose usable
coordinates, it is not plotted; a missing timestamp means unknown fix age.
The adapter has fixture-level tests, not a validated production scraping
session against a currently accessible website.

The endpoint requires server-validated supply.view permission derived from the authenticated session. It never expects a client-supplied organizationId and no WATCHTOWER_MST_ALLOWED_ORG_IDS variable is needed for public-page mode. If the environment flag is missing or disabled, public scraping remains off. Consent, source permissions, and website access limits still apply.

## November 2026 authorization and parser fix
The global radar is protected by server-side account status and active
intelligence-view membership checks (or a verified platform super-admin).
This makes it independent of the chosen organization, but DOES NOT open
the endpoint anonymously. No WATCHTOWER_MST_ALLOWED_ORG_IDS or
client-supplied organizationId is required.

Public PHP/JS vessel pages may expose coordinate variables without an
AIS fix timestamp. The parser can show those real webpage coordinate pairs
as **webpage_capture** with unknown position freshness. They are dimmed
on the map and are never considered fresh AIS observations. No timestamp is
fabricated. Reported AIS positions remain separately dated.

Candidate sampling includes ports on the Gulf, Hormuz, Gulf of Oman,
Red Sea and Gulf of Aden rather than exhausting the budget on the first port.
Up to 48 pages per cycle are read with bounded concurrency. The 5-minute refresh is a dashboard polling interval and
not a promise of new upstream AIS fixes. A refused website request
must remain unavailable, with diagnostics rather than fake vessels.

## GCC discovery parity with Python 12-per-port sampling (November 2026)
The browser originally defaulted to four candidate pages per hub, further
capped sampling at eight per hub / 24 total, and discarded every vessel
whose classification was not recognized as dry cargo. The map also
defaulted to an all-modes freight-only filter. This was not equivalent
to the Python script, which inspects 12 vessels per hub and reports
service boats, passenger craft and other non-food vessels.

The adapter now scans up to 12 vessel-page candidates for each of the three
verified public ports (36 maximum per scan). Candidate selection rotates
among ports rather than exhausting the first. Ships without a readable MMSI
get a stable, page-based ID; NO MMSI is invented. The map now shows all
identified ship types by default and has an explicit "Only identified
cargo-class ships" filter. Freight aircraft filtering remains independent.
Cargo classification and food manifests are always distinct.
Diagnostics show candidate/inspected/mapped/cargo-class totals for each port.

Website source access, HTML layout, actual coordinates and permitted use
remain independent limitations: the result is not guaranteed to match
the number of ships printed by a local Selenium browser.

The public HTML radar considers up to 12 candidate vessel links PER PORT,
matching the Python sampling ceiling. The overall regional page budget is
48 per scan, weighted toward the original three source ports and distributed
across additional verified ports. The old WATCHTOWER_MST_MAX_SHIPS_PER_HUB
environment variable is ignored in this mode. This is NOT a guarantee of
12 mapped positions from each port.

## Default Esri regional operating picture
The Watchtower now opens centered at 22.5°N / 50°E (zoom 4.5), covering
the Gulf, Red Sea, Bab el-Mandeb and Gulf of Aden. The default data filter
encloses approximately 9°–36°N and 31°–68°E. A global map option remains
available. Scope limits where OBSERVED ship coordinates appear; it does not
create or imply live AIS coverage across the entire polygon. Select an
individual port from the regional port filter to zoom in without changing
the source's evidence requirements.
