# Map-first Food Security Watchtower

`/dashboard` and `#watchtower-map` now open the interactive global map. Existing
food situation, operations, scenarios, agents and their hash links are preserved.

## Interface

Full-workspace dark map and browser fullscreen; globe/Qatar/region focus;
search by callsign, MMSI, vessel or alert; mode/layer filters; zoom clustering;
selected-asset details; observed session history; source-status panels; hazard,
aviation, maritime and organization food-security alerts. No mock traffic is
inserted when a provider is unavailable.

Public tracking refreshes every 60 seconds. Polling stops in hidden tabs, can be
paused and is cancelled on unmount. The server coalesces concurrent requests and
caches public observations briefly. Organization records are never cached there.
Read access requires a valid Supabase session. Existing food-data authorization
and live/organization scope checks are preserved.

## Aircraft

ADSB.lol queries six global airframe samples: B744, B748, B77L, B763, B752, A306.
This is NOT all global flights. Receiver coverage and partial query failures
limit the observations. Freight-operator callsigns are heuristic candidates;
passenger variants and mixed operators are unverified. No food manifests,
supplier identity, purchase-order association or destination are inferred.

Docs: https://api.adsb.lol/docs
License: https://www.adsb.lol/docs/open-data/api/ (ODbL 1.0, attributed in UI).
For production reliability, establish appropriate provider terms and capacity.
Set server variable `WATCHTOWER_ADSB_ENABLED=false` to disable this public fallback.

## Cargo vessels: configuration required

Set the server-only `VESSELFINDER_API_KEY` in the deployment environment, with
an eligible VesselFinder **LiveData area subscription**, not just individual
vessel lookup. The licensed geographic area controls coverage. Requests use
`/livedata?format=json&interval=30`; filters retain AIS cargo classes 70-79.
The key is never sent to the browser or included in error messages. No paid
subscription is purchased by the code.

Without an eligible key, ships are **not connected**, the count is **N/A**, and
no fictional ships are displayed. The adapter is implemented; worldwide AIS
coverage is NOT supplied automatically. Each transport mode is capped at the
2,000 latest valid observations. Oversized/invalid feeds fail closed.

Docs: https://api.vesselfinder.com/docs/livedata.html

## Alerts and food security

GDACS recent red/orange event points (returned response, at most 120), existing
EASA CZIB advisories and UKMTO-derived Hormuz reports are attributed to their
sources. EASA advisories are NOT airspace closures or NOTAMs. Representative
country airports and the Hormuz reference point are NOT exact risk boundaries
or incident locations. Unmapped/absent alerts do not establish a safe route.

Organization food signals reuse `/api/watchtower/food-security` with a 30-day
outlook. Qatar is only a navigation anchor, not a geolocated incident or a
national aggregate. Commodity filtering applies to those signals, not manifests.
Only real hazard points are used in the 350 km proximity panel, never approximate
aviation or maritime anchors. Proximity is not proof of impact or a probability.

## Esri political basemap and Growa visual identity

The Food Security Watchtower uses **Esri Light Gray Canvas** as a neutral,
political and administrative world basemap. It has a country/region outline base
and a transparent reference layer showing places and selected cities:

- Base: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`
- Labels: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`

Both are Esri raster services with worldwide coverage, and are licensed by Esri
and its contributors. Their attribution remains visible. The optional reference
labels are placed in a non-interactive Leaflet pane above production risk
polygons, but below flight/vessel icons; risk and transport layers still receive
click/hover actions. The existing Growa agricultural SatelliteMap uses its
original satellite basemap and is unaffected.

The map supports pan, zoom, clickable cargo aircraft and vessel observations,
screen zoom clustering, source-backed route references, alerts, semi-transparent
food-production risk zones, country context and coordinate inspection.
The existing responsive fullscreen and world-wrap logic is unchanged.
Requests fetch only visible tiles; no automated bulk cache or export.

**Lifecycle note:** Esri announced that these legacy raster Light Gray Canvas
services are scheduled for retirement in **December 2029**; the supported
long-term upgrade is its vector Light Gray Canvas basemap. This implementation
avoids introducing a new vector renderer into the existing Leaflet tracking
stack, but the migration should be planned before retirement. Source:
https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/announcements/sunsetting-legacy-basemaps


The Watchtower's header, tab navigation, filter panels, KPI cards, source pills,
alerts and map controls follow **Growa's light-first design tokens** (white,
warm stone, sage green, cream and ink), not the previous blue-neon Palantir
mockup. The physical imagery remains a full-screen map backdrop.

The canonical first-screen URL is
`/dashboard?module=watchtower#watchtower-map`, including login and role
landing routes. Explicit module deep links and other Watchtower tab hashes
are preserved. Old `NEXT_PUBLIC_WATCHTOWER_TILE_URL` overrides are ignored
by the Esri Watchtower component; the existing agricultural SatelliteMap is
unchanged.

## Observation integrity

Aircraft older than 2 minutes and ships older than 10 minutes are faded/stale.
Ingestion excludes aircraft positions older than 15 minutes and ships older than
30 minutes. Request time never replaces observation time. Unknown readings stay
null, including AIS sentinel heading/course/speed values. Selected-asset trails
join only positions received this session; gaps over 5 minutes and dateline
jumps are broken. No interpolation, synthetic itinerary or predicted positions.

Static chokepoints are neutral references, not closures. Counts are filtered
observations, not world totals. No congestion percentages, reserve months,
shipping manifests or automatic rerouting are fabricated.

## Checks

`lib/watchtower/global-tracking.test.ts` covers parsers, freshness, cargo
classification, deduplication, source boundaries and map-first integration.
Run `npm test -- lib/watchtower/global-tracking.test.ts`, `npx tsc --noEmit` and
`npm run build` in the complete project. Verify real provider connectivity and
AIS entitlement in the deployed environment.


## Full viewport imagery on large and ultrawide displays

The initial ESRI overview zoom is now calculated from the actual Watchtower
map container size with `getWorldFillZoom`. It is the smallest 0.1-step
Web-Mercator zoom whose tile world is at least as large as the viewport in
both dimensions. A 1736px-wide screen typically starts near zoom 2.8
instead of the old fixed zoom 2, eliminating uncovered grey side panels.
The minimum zoom also adapts when switching browser fullscreen or resizing.

Leaflet is configured with `worldCopyJump: true` and the ESRI tile layer
with `noWrap: false`; the former hard `maxBounds` clipping has been removed.
These changes let Esri political tiles repeat across the antimeridian during
horizontal panning instead of ending in empty grey columns. The visual
map always fills its CSS host, beneath overlay controls and panels.
The Esri political base, label attribution and interactive markers remain.

Regression tests live in `lib/watchtower/map-viewport.test.ts`.


## Selected-aircraft / vessel route visualization

Click a tracked aircraft or vessel to render **two clearly distinguished
route segments** above the interactive ESRI basemap:

- **Solid Growa-sage line / Completed – observed**: real chronological
  ADS-B or AIS fixes received during the browser session, at the provider's
  reported observation times. Discontinuities due to long observation gaps,
  impossible jumps or missing readings are kept separate. The display does not
  claim the complete voyage or departure history from one or two fixes.
- **Dashed ochre line / Remaining – estimated**: a limited geodesic
  continuation of the latest reported speed and heading, not a provider flight
  plan or a ship's navigational route. Aircraft horizon is at most 20 minutes;
  vessel horizon is at most 60 minutes. The line disappears when the observation
  is stale, the heading or speed is missing, or the vehicle is nearly stopped.
  A projected endpoint is visibly marked, but is **NOT a destination**.

Two independent map-layer toggles control observed route and estimated future
segment. Only the selected aircraft/vessel receives lines to prevent global
clutter. The route details state the horizon, estimated distance, source time
and planning limitations. Tracking signals and cargo contents remain unverified
unless an actual plan/history provider supplies appropriate evidence.

Browser history is bounded per asset (3h aircraft / 12h vessel) and uses only
samples observed since page load. It is **not** a provider-supplied archive and
does not survive browser reload. Moving an asset's marker does not simulate
position or generate route fixes.

Pure route geometry and history constraints are tested in
`lib/watchtower/route-geometry.test.ts`. In particular, antimeridian segments
are kept on a continuous world copy so no artificial whole-world line appears.


## Watchtower alert list separation and readable map details

The floating **Food Security & Risk** inbox now renders only external,
source-backed advisories / hazard reports. Organization food ledger entries are
excluded from the inbox, while the organization's commodity KPI and map layer
remain available in their original roles. The 'Mapped risk reports' number
reflects the filtered external reports and is not inflated by internal ledger
records. Alert source failures remain visible through the provider status chips.

Leaflet alert tooltips have responsive minimum and maximum dimensions and
normal text wrapping. They must not shrink into narrow vertical ribbons.
The associated right-side detail panel is wider, uses Growa light-mode styling,
and allows long links, identifiers, and descriptions to wrap naturally.
These changes are presentation-only; no source event classification, locations,
or third-party alert titles are modified.


## Automatically visible routes (no selection)

Every tracked vehicle with recent provider heading and speed now automatically
shows a yellow dashed forward-course projection on the Esri map, even when
nothing is selected. Solid green observed trails appear automatically once at
least two distinct provider positions have been captured in this session.
These are not complete historical itineraries or confirmed carrier routes.
Long observation gaps and impossible coordinate jumps are not joined. The
selected vehicle is only highlighted and gains an endpoint marker; selection
is not necessary to display its lines. The legend counts currently eligible
forward projections. Filters for mode, region and route layer still apply.
AIS vessels remain unavailable when the licensed feed is not connected.


## Last-known direction guides for stale ADS-B and AIS samples

ADSB.lol may return aircraft whose latest valid observation is older than the
120-second live-freshness window. These cannot honestly receive a forward
position forecast, and a single observation cannot be turned into an
historically completed trail. Previously such assets drew no line at all.

The Watchtower now draws an independent **screen-length direction indicator**
for each valid observed heading/speed, including slightly stale positions. It
uses 38 screen pixels (65 for the selected vehicle), not a fabricated route
length in kilometers. Recent direction cues are pale gold; stale observations
are grey and are identified in their hover tooltip and the observation panel.
These cues are NOT a planned route, historical path, current vehicle movement,
confirmed closure or predicted destination. Stale cues expire at 15 minutes
for air and 30 minutes for AIS, matching the existing ingestion limits.

Verified historical tracks require a licensed trace/history API. The solid
green route still requires two independently observed fixes during the session.
The short gold geographical forecast remains limited to genuinely fresh
positions (2 minutes air / 10 minutes AIS). This explicitly separates
**observation**, **short projection**, and **schematic last-known bearing**.


## Source-backed origin / destination route intelligence

The Watchtower now enriches observed aircraft using a BOUNDED batch POST to
the ADSB.lol `/api/0/routeset` callsign lookup endpoint. It can return
airport-pair coordinates and an API-provided `plausible` flag. This is NOT a
dated flight plan, proof of takeoff, or the actual flown path. Returned lookup
pairs are mapped automatically as an origin-to-last-position dotted
**reference leg** and a last-position-to-destination dashed **reference leg**.
They use geodesic geometry, not airways or airspace restrictions.
The panel shows airports, IATA/ICAO code, source and confidence. Unknown,
multi-leg or unlocatable pairs are not drawn as complete itineraries.

For subscribed VesselFinder LiveData AIS + VOYAGE responses, the platform
displays the **last reported port of call** (NOT a proven cargo-loading
origin), departure timestamp if provided, crew-entered AIS destination
and ETA if available. Ports are geocoded only from documented reference
UN/LOCODEs/known hubs. When both endpoints resolve, the backend may compute
up to eight **modeled land-avoiding ocean-network reference paths** per
snapshot from origin to current position and current position to destination.
It does not claim these are captain-approved voyages, actual sailed
tracks or current vessel schedules. If endpoints or network paths fail, names
remain visible but no maritime reference line is invented.

All itinerary overlays use a different style from actual observed
telemetry. Solid green historical traces still require multiple observed
fixes; dotted origin reference and dashed destination reference are
NOT completed/planned routes verified by the carrier. Exact route and
departure/arrival verification require a flight-status/flight-plan and
vessel port-calls/traces provider with the appropriate entitlement.

The provider's lookup and coverage may be incomplete. Batching is capped;
failure never removes basic position observations. Tests cover parsing of
plausible/unverified routes, callsign matching, port lookup, incomplete
voyage data, and labeling.


## Fast aircraft loading and fallback origin/destination sources (November 2026)

The previous Watchtower waited for six independent ADS-B aircraft-type
requests, a callsign route batch, GDACS, EASA, UKMTO and AIS before delivering
any positions. That made the map feel stalled when any source was slow.

The authenticated tracking endpoint now supports `?stage=quick` (four priority
cargo-capable airframe samples, no alerts, no route lookups) and a separately
cached `?stage=full` (the two remaining types plus AIS and global advisories).
The client launches both stages and displays quick positions as soon as the
first completes; it merges full sources/alerts without discarding any
previously observed aircraft. Neither stage waits for origin-destination.

A separate authenticated `/api/watchtower/routes` endpoint performs one
bounded ADSB.lol batch lookup after the first aircraft observations are ready.
Only priority cargo-operator callsigns with no usable airport pair may fall
back to the ADSBdb `/v0/callsign/{callsign}` API. That fallback is limited to
eight aircraft, up to four concurrent requests with individual short timeouts;
positive lookups cache 30 minutes and negatives five minutes. Caches and
responses are bounded, and reused callsigns are matched with aircraft hex and
current callsign before attaching itinerary metadata.

ADSBdb provides airport coordinates for some callsigns but is not a dated
active-flight record. Neither ADSBdb nor ADSB.lol guarantees route coverage,
and both can return stale or reused callsign mappings. The UI only renders
origin/destination geometry when a provider returned both airport coordinates;
otherwise it says unavailable instead of assigning an airport by direction.
Actual aircraft waypoints and historical flown traces still require a
flight-plan and history provider. VesselFinder LiveData / VOYAGE remains
required for last port and declared destination of cargo vessels.

The UI preserves route enrichment across successive position-only refreshes,
without claiming that the aircraft stays on the same dated flight indefinitely.
The current implementation prioritizes initial responsiveness and transparency;
it does not guarantee all source endpoints can be reached from Vercel or that
all tracked flights will have an identifiable itinerary.


## Semi-transparent global food production risk zones

The Watchtower map has an independently fetched, authenticated layer:
`GET /api/watchtower/production-risks`. It renders semi-transparent high
(red-ochre) and elevated (amber) geographic screening regions beneath aircraft
and vessel overlays, on the interactive Esri political basemap.

Source observations: recent red/orange GDACS hazard points already ingested by
the existing Watchtower server. Supported categories are drought, flood,
tropical storm, wildfire, volcano and earthquake. Only event evidence actually
returned by GDACS enters the response. Up to 18 recent events are screened per
cycle and server results cached for 20 minutes. No fabricated historical
incidents, countries or crop losses are inserted.

Boundaries: source event points are queried against Esri World Administrative
Divisions first-level administrative region polygons. A matching ADM1 region
is colored for **screening only**. It is explicitly NOT the reported hazard's
verified footprint or a claim that the whole region's farmland was damaged.
Where Esri cannot resolve an admissible shape, the map shows an event-centered
**approximate screening radius** with dashed border rather than pretending to
have an official polygon. This proxy has no verified relationship to area of
impact. Esri data copyright and licensing restrictions apply: Esri/Garmin
World Administrative Divisions is an administrative reference, not a GDACS
disaster extent product. Map labels retain the source event and timing.

Clicking a zone opens a readable panel with source, timestamp, severity,
risk driver, possible crop / farm exposure and qualitative pathways by which
the shock may influence irrigation, supply, handling, transport and
replacement sourcing costs. **No percentage crop losses or QAR price
increases are invented**. Exposure to imports and final costs requires
verified crops, producer locations and supplier shares. A blank zone does not
mean safe production.

The zone layer is on by default, with on/off and hazard-type filters.
The effect runs independently of tracking, so slow boundaries do not delay
aircraft positions. ESRI basemap remains fully interactive; polygons are
below the selected aircraft and maritime tracks.

Data availability boundaries:
- GDACS is a global disaster alert, not a global crop-health index.
- FAO ASIS drought/agricultural-stress layers, country crop production
  calendars, port cost data and supplier-specific price observations
  are NOT currently integrated into these polygons.
- Some major medium-term food production risks are therefore NOT mapped
  by this live-event layer; the panel explicitly labels the coverage.
- Source metadata and review remain essential for decisions.


## Map route decluttering (latest update)

The Watchtower no longer draws the short pixel-length bearing/orientation
indicators or the separate 20-minute/60-minute heading-based forward
projections in front of aircraft and vessels. These lines were easily mistaken
for itinerary segments and cluttered the political map. The UI legend and
vehicle details no longer advertise them.

The map now renders only the available **origin → observed position** and
**observed position → destination** reference itineraries from source-backed
airport or port associations and the actual observed session track once two
independent fixes exist. These geographic routes are visible without clicking
a vehicle. Reference itineraries are still estimates, not authenticated
historical tracks or carrier flight plans. If provider endpoints are missing,
the map shows the marker alone rather than a fabricated route.
