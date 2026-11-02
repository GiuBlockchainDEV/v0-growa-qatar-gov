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

## Map configuration

OSM raster tiles are darkened locally, with attribution preserved and no bulk
prefetch. For sustained production traffic, use an appropriately licensed HTTPS
raster provider via `NEXT_PUBLIC_WATCHTOWER_TILE_URL` containing `{z}/{x}/{y}`.
Set `NEXT_PUBLIC_WATCHTOWER_TILE_ATTRIBUTION` to its required plain-text credit;
implement any additionally required links before using that provider. Only
browser-safe/public tile tokens belong in NEXT_PUBLIC variables.

Policy: https://operations.osmfoundation.org/policies/tiles/

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
