# Watchtower GCC maritime radar (MyShipTracking API)

This is an optional **licensed provider integration**, inspired by the
user-supplied Selenium/Python script. The new integration does NOT use headless
Chrome, anti-bot disguises, website scraping or browser credentials.

## Coverage

User's original port workflow:
- Port of Jebel Ali / Dubai (AEJEA)
- Doha (QADOH) and Hamad Port (QAHMD), separately identified
- Ras Laffan (QARLF)

The server reads recent real port calls and requests the associated vessel
positions and reported voyage endpoints through MyShipTracking's official
`/api/v2/port/calls` and `/api/v2/vessel/bulk?response=extended` APIs.
The frontend polls `/api/watchtower/gcc-radar?organizationId=<uuid>` every
**300 seconds** while the signed-in dashboard remains open and visible.
Server calls are coalesced and cached. There is **no autonomous background
scraper or cron**; keeping the browser closed does not guarantee polling.

The radar follows the Python logic by screening recent port calls, excluding
speed below 1.5 knots, omitting known local origin==destination loops, capping
the ship population by hub, and showing actual provider GPS fixes, course,
reported last/next port, ETA and timestamp. It does not infer that a bulk
carrier transports food; manifests are unavailable.

The existing ESRI political map, aircraft observations, public AIS at Hormuz
and Bab el-Mandeb, and hazard overlays remain in place.
When both port coordinates can be resolved, the code attempts ocean-network
modeled legs from last port to observed vessel position and then to declared
destination. These are labelled **reference routes**, not measured traveled
routes or authoritative voyage plans. Source-reported AIS history, if a
licensed provider supplies it, must remain distinct.

## Configuration / authorization

Set these server-side Vercel variables (never NEXT_PUBLIC):
- `MYSHIPTRACKING_API_KEY` — actual licensed API key
- `WATCHTOWER_MST_ENABLED=true`
- `WATCHTOWER_MST_ALLOWED_ORG_IDS=<your-organization-UUID>`
- `WATCHTOWER_MST_MAX_SHIPS_PER_HUB=4` (1–12, default 4)

Each request authenticates the user and enforces `supply.view` for the
organization before checking the separate explicit allowlist. Without the
required configuration, the UI shows **not configured** and makes **zero
billable provider requests**. No key has been provisioned or verified here.

The API bills for actual returned port-call dates and extended vessel
records. MyShipTracking describes 5 credits per distinct day with calls and
3 credits per vessel for extended positions. Polling every five minutes can
therefore become costly if many hubs or vessels are enabled. The code limits
per-hub candidates, caps modeled routes, coalesces in-flight requests,
honors server revalidation and exposes `X-Credit-Charged` if provided.
Observe usage and agree on budgets before enabling.

The real positions may be stale or unavailable because the service documents
**terrestrial AIS** coverage only. Neither the HTTP polling cadence nor
the timestamp of the cached response means the ship itself updated its
position five minutes ago. Missing data is not filled with fabricated ships.

MyShipTracking provider documentation:
- https://api.myshiptracking.com/docs/port-calls
- https://api.myshiptracking.com/docs/vessels-current-position-api
- https://api.myshiptracking.com/docs/vessel-current-position-api
- https://api.myshiptracking.com/docs/vessel-historical-track-api

Terms and redistribution restrictions must be reviewed by Growa before
displaying provider data to outside parties.
