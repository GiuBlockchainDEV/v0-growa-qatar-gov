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
- WATCHTOWER_MST_MAX_SHIPS_PER_HUB=12 (default and maximum 12)

No MYSHIPTRACKING_API_KEY is required for public HTML mode, and no
billable MyShipTracking API request is made when this flag is enabled.
The public website has rights and usage restrictions; enabling automated
collection and redistribution requires the operator to ensure they are
authorized. The system honors access blocks and CAPTCHAs. It does not spoof
human browsers, evade bot detection or use hidden API endpoints. If a
page is inaccessible, show source unavailable rather than fake vessels.

Configured public ports:
- Jebel Ali: /ports/port-of-jebel-ali-in-ae-uae-id-228
- Doha: /ports/port-of-doha-in-qa-qatar-id-5833
- Ras Laffan: /ports/port-of-ras-laffan-in-qa-qatar-id-5836

Hamad Port is retained as a selectable cartographic hub, but no independently
verified public HTML port URL is wired for it. The tracker will not pretend
Doha and Hamad are identical. Source-page changes can break extraction.

## Cadence
While a user with the server-validated supply.view permission keeps the Watchtower tab visible, the browser polls
GET /api/watchtower/gcc-radar every 300 seconds.
The server caches HTML pages and results for five minutes; up to
12 candidate vessel pages per each of Jebel Ali, Doha, and Ras Laffan
(36 total) are inspected in bounded waves of nine pages. There is no permanent server worker or guaranteed five-minute update
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

Candidate sampling now rotates across Jebel Ali, Doha and Ras Laffan,
rather than using the entire quota on the first port. At most 24 candidate
pages per scan (up to eight per public hub) are read with bounded
concurrency. The 5-minute refresh is a dashboard polling interval and
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
