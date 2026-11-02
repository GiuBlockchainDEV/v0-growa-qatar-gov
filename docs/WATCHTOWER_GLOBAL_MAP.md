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

## Esri interactive basemap and Growa visual identity

The global Watchtower now uses the same Esri ArcGIS World Imagery raster tile
service as the existing Growa satellite map:
`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`.
The map supports pan, zoom, clickable aircraft and cargo-vessel markers,
zoom clusters, selected alert details, checkpoint overlays, route history
from observed samples and click-to-inspect coordinates. Tiles are rendered at
their actual colours (no CSS inversion or simulated geography). Leaflet remains
the interaction/rendering library over Esri's imagery tile service.

Esri and contributing imagery sources are attributed in the visible map UI.
Browser requests are scoped to visible tiles, without automated bulk caching.
Review Esri's applicable licence/service terms before high-volume production.

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
These changes let ESRI tile images repeat across the antimeridian during
horizontal panning instead of ending in empty grey columns. The visual
map always fills its CSS host, beneath overlay controls and panels.
The original ESRI data source, attribution and interactive markers remain.

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
