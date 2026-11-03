# MyShipTracking public HTML GCC radar (opt-in)
This mode follows the user-provided Python Selenium/BeautifulSoup discovery
workflow: inspect public port lists, follow bounded vessel links, retain
timestamped positions, speed >=1.5 knots, cargo-type confidence and
source-reported last port / destination. Do not claim a position is live
merely because a page was fetched recently. A voyage/reference route can be
modeled using server-side ocean-network geometry, but is not a sailed AIS
trajectory. Historical tracks need a separate provider with timed fixes.

## Activation / permissions
Set these SERVER variables in Vercel:
- WATCHTOWER_MST_SCRAPE_ENABLED=true
- WATCHTOWER_MST_MAX_SHIPS_PER_HUB=4 (up to 12)

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
The server caches HTML pages and results for five minutes; requests for up to
12 candidates per hub are constrained, including at most four vessel pages at
once. There is no permanent server worker or guaranteed five-minute update
when the web page is closed. Last AIS-observed timestamps are shown separately.

If WATCHTOWER_MST_SCRAPE_ENABLED is not explicitly true, the existing optional
licensed API branch remains available only with its own explicit opt-in,
key. The global radar endpoint does not fall back to the paid API.
When public collection is disabled, the UI shows "not configured".

The public-page parser is deliberately conservative. If the website's
actual HTML lacks explicit cargo-type classification, dated GPS positions,
and speed, it will return zero accepted ships rather than invent them.
The adapter has fixture-level tests, not a validated production scraping
session against a currently accessible website.

The endpoint requires server-validated supply.view permission derived from the authenticated session. It never expects a client-supplied organizationId and no WATCHTOWER_MST_ALLOWED_ORG_IDS variable is needed for public-page mode. If the environment flag is missing or disabled, public scraping remains off. Consent, source permissions, and website access limits still apply.
