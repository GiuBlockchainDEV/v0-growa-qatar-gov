# NFII Logistics Intelligence: multimodal food corridor screening

Implemented on **/dashboard/logistics**, separate from the persisted organization-owned
shipment registry. It does not issue a booking, change a shipment status or create
real carrier events. It can prefill product/country/tonnage from an **approved PO**
in the currently visible organization. Preview orders are explicitly examples.

## Workflow

1. Choose food product, country (only supported geographic gateway references),
   shipment tonnes (0.1–200), delivery limit in days (1–120), and optionally
   a linked approved purchase order.
2. Optionally add carrier **freight quote rates in QAR/tonne**, one per mode.
   Empty rates always render **N/A**. No invented tariffs.
3. Click **Compare transport options**. The API requires authenticated user
   and optionally checks \`supply.view\` for an organization ID.
4. Review charts for relative screening-risk index, planning days and
   quotation-derived freight cost in QAR/kg; then compare every available
   geographic corridor and open the risk drivers for a selected option.
5. Ask a real forwarder or carrier for offered service, quote, routing, proof
   of cold chain, clearance and actual sailing/flight/road schedules.
6. Separately create the real shipment from an approved purchase order
   in the existing NFII Operations ledger. The intelligence screen **does not
   perform that mutation**.

Endpoint: \`GET /api/nfii/logistics/corridors?country=IN&commodity=rice&tonnes=20&limitDays=40\`

Optional QAR/tonne quotes: \`seaRate\`, \`airRate\`, \`roadRate\`. Quantity and
price are user inputs, not scraped rates or an offered commercial price.
Freight cost displays \`rate_qar_per_tonne * shipment_tonnes\` and
\`QAR/kg = rate_qar_per_tonne / 1000\`.
Insurance, drayage, port charges, demurrage, duties, reefer power and spoilage
are **not** included without documented quotes.

## Coverage and limitations

- 39 representative export-gateway countries. A reference hub means a
  geographic point **only**, not a confirmed port service, flight or
  cross-border trucking route. This is not all real routes worldwide.
- Modes: direct sea; optional sea via Jebel Ali and Salalah; direct air;
  candidate air transfer via Dubai; regional road (GCC + Jordan reference).
  These are **scenarios**, not airline/carrier services and not a claim that
  such connections operate today.
- **SeaRoutes** optional licensed route geometry and theoretical vessel
  duration, server-side \`SEAROUTES_API_KEY\`. API:
  https://developer.searoutes.com/reference/getsearoute.
  Routing endpoint returns geometry and voyage duration, **not** berth
  availability, carrier voyage ID or real shipment ETA.
  Missing SeaRoutes means sea distances are labelled
  **great-circle lower bounds** and sea ETA is **N/A**; not a simulated
  navigation time passed off as truth.
- **World Bank** country LPI via
  https://api.worldbank.org/v2/country/IN/indicator/LP.LPI.OVRL.XQ?format=json.
  LPI survey scores are historical (mostly 2023, not contemporary real-time
  performance). National ranking cannot measure a specific cargo lane.
- **Open-Meteo marine** only via licensed commercial
  \`OPEN_METEO_COMMERCIAL_API_KEY\` at the customer API host.
  The sampled **departing port grid** wave forecast cannot establish weather
  conditions for all sea legs, dates, or the arrival port.
  https://open-meteo.com/en/docs/marine-weather-api
- Air distance is a straight-line minimum, not an actual flight plan.
  Air time is a **planning assumption** (air distance / 750 km/h plus
  2.5 days handling, +1 day nominal transfer).
- Road distance is a **geometric estimate** (straight line x 1.4) and road
  transit time is a **heuristic** (km / 550 km/day + 1.4 day handling).
  No road directions engine, border status, driver constraints, permits or
  verified trucking service are connected.
- Screening risk (0–100) is a transparent **deterministic heuristic** and
  is **not** an observed disruption probability, disaster alert, political
  risk estimate, shipping insurance score, or official Qatar decision.
  Factors include unverified routes/schedules, LPI survey and vintage,
  fresh-food requirements, deadline pressure, extra transfers and lack
  of quotes. A missing provider raises uncertainty rather than declaring
  the situation safe.
- Fresh food constraints (e.g. lettuce, fresh milk and vegetables) reflect
  rough screening categories; specific SKU freshness, harvested date,
  packaging, pre-cooling and validated remaining shelf life must be supplied
  before a real decision.
- UN/LOCODE and airport labels are representative hints; no verification
  of shipping line service or Qatar import licences.

## Data governance

No external key returned to the browser or stored in the source.
The only network calls are built from an allowlist of known endpoints
and fixed origin hubs; the user cannot specify an external URL, vessel ID,
headers or path. The API is read-only and uses existing authentication.
No Supabase migrations or new database permissions were added.

Configured providers must be used under their commercial licence and rate
limits. A missing rate or sea routing service is never silently replaced
with a made-up number, and each corridor includes its evidence level.

## Improved API evidence and pricing (2026-11-01)

NFII now supports **four external data feeds**, and never invents a carrier offer:

- **Freightos Shipping Estimates**: publicly accessible, non-binding marketplace
  range, for compatible dry standard 40-foot FCL loads (1–22 tonnes).
  Endpoint: `https://ship.freightos.com/api/shippingCalculator`. An explicit
  Freightos credit and source link is displayed in the UI, as required by
  their API terms. USD ranges are converted to **QAR per kg** and total QAR
  at the Qatar USD peg of 3.64. The service may return no coverage or a
  temporarily unavailable response; in that case **N/A** is shown.
  It does not price reefer containers, or fresh refrigerated food,
  nor does it confirm insurance, drayage, customs or carrier capacity.
  API docs: https://ship.freightos.com/api/shippingCalculator
- **Google Routes API**: if `GOOGLE_ROUTES_API_KEY` is configured,
  supplies actual road-network distance and basic driving duration for
  eligible regional road scenarios. The duration is a **passenger-car**
  observation, not a trucking or cross-border clearance guarantee.
  NFII keeps a separate commercial-road transit planning allowance.
  Source: https://developers.google.com/maps/documentation/routes/compute_route_directions
- **SeaRoutes API**: optional `SEAROUTES_API_KEY`, used for navigable
  geometry and theoretical duration where the commercial API responds.
  This is not a sailing schedule or carrier delivery ETA.
- **World Bank LPI**, openly accessible and historical, plus optional
  **Open-Meteo Marine** commercial `OPEN_METEO_COMMERCIAL_API_KEY`,
  for risk context at the departure port. Commercial marine hostname
  is `customer-marine-api.open-meteo.com` (not the general weather
  customer host). This is not a forecast along the complete voyage.

Provider calls are bounded by timeouts and API responses are validated.
No provider secret is shipped to the browser.

**Comparative charts**: the risk chart is a **heuristic screening index**;
the transport-day chart distinguishes routing evidence from assumed transit
time; the quote chart uses **entered freight rates**, while an independent
Freightos cost-range visualization shows market benchmark limits when
available. Provider availability and source links are visible.

**Scope**: only origins with crop-matched suppliers from Procurement may
be selected. Published company candidates and tenant-approved suppliers
(with current approved commodity contracts) remain separate categories.
A published candidate is not automatically an approved supplier.

**Not yet integrated**: commercial booking or carrier-provided ETAs,
refrigerated freight RFQs, live vessel positions, customs rates, actual
shipment tracking, and global insurance quotes. These require licensed
providers and explicit account configuration; no surrogate data is shown
as a real quote.

## Verified-only routes and incident context (2026-11-01 correction)

**Correction of misleading previous outputs**: the original screening repeatedly
showed numerical risk scores such as 43/47/72/84 and pseudo-precise air
journeys such as 2.8/3.8 days. Those numbers came from fixed additive
penalties and assumed handling time. **They have been removed**.
Without a carrier schedule/ETA, air/road transit times are now **N/A**.

The map draws **maritime navigable geometry** from SeaRoutes where it passes
endpoint and transfer-hub validation, or an explicitly modeled ocean-network
alternative where available. If no maritime geometry exists, only sea markers
are shown. Maritime hub alternatives are not listed without validated provider
geometry. The shortest sea path is a theoretical navigable route, **not evidence
that a liner operates a direct commercial service**.

The **air mode** is always shown separately as a **yellow dashed sampled
great-circle reference** between the representative origin airport and DOH.
This is a spherical geodetic path, not a straight longitude/latitude chord.
It is explicitly **illustrative**, not verified airways, an airline's actual
flight path, available cargo service, booked itinerary or live aircraft tracking.
No flight ETA is inferred. Air references are shown in preview as well as
after screening, while the absence of maritime geometry is still signaled
independently.

The old risk **0–100 heuristic** has been retired. Risk context now presents
**GDACS official orange/red alerts** within a 400 km search radius of
the reference origin port or Qatar over the last 21 days, using
https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH .
Each result displays event severity, kind, location proximity and a
source link. This is NOT route-wide hazard coverage, vessel insurance
risk, a confirmed disruption or a probability. Provider failures are
shown as **risk unknown**, not as safe/low risk. A successful query with
no nearby alerts is NOT proof that the itinerary is safe.
World Bank historical LPI and departure-port Open-Meteo waves remain
separately attributed context, not numerical penalty points.

SeaRoutes routing durations remain theoretical vessel voyage times.
No actual carrier schedules, ocean freight booking, or heavy-truck ETA
have been obtained unless a future licensed source explicitly supplies them.

## Offline maritime route fallback and restored calculations (2026-11-01)

When the optional commercial SeaRoutes API is missing/unavailable,
NFII computes the primary origin-to-Qatar route on an **ocean-grid network**
using the MIT-licensed `@arcnautical/maritime-routing` local engine.
It is neither a direct overland line nor a commercial carrier's service
or schedule. Geometry comes from an open-source OSM-derived sea mask;
estimated sailing days assume **14 knots**, excluding port dwell, export
handling, customs, transshipment and disruptions. The estimate and
route source are explicitly labeled as **Ocean network · estimate**.
SeaRoutes' published geometry and theoretical time take priority when
available.

Extra via-Jebel Ali or via-Salalah routes are only compared when backed
by provider geometry; airline transfers are not inferred automatically.
Airline and trucking door-to-door ETA remain unknown without schedule/
cross-border service evidence. These limitations do not block the offline
maritime geographic scenario or its estimated sailing-time chart.

The package reads its binary ocean-grid asset at runtime; Next.js
`serverExternalPackages` preserves that asset. Unit tests exercise
a real India → Qatar ocean path, not just fabricated example coordinates.


## 2026-11-01: Air planning days and incident-backed Gulf screening
Airport-to-airport cargo days are now modeled as reference great-circle km /
750 km/h + 24h cargo handling + 6h operational buffer, expressed in days.
The result is never a published flight schedule, a NOTAM-compliant flight
plan, air traffic tracking or a carrier ETA.

Security sources are independently fetched server-side: active unexpired EASA
CZIB advisories, hormuz.data-tracking.net open AIS crossing counts (24h and
30 days), UKMTO-derived incident data from the public Hormuz monitor and
existing GDACS regional hazard notices. Unknown, stale or unavailable sources
are explicit. AIS counts can underreport under jamming and restrictions.
The output never confirms a waterway or FIR is open/closed without valid
official operating notices. The geographic exposure of reference ports to
Hormuz is assessed separately for each maritime corridor.

The 0–100 value is a *weighted relative exposure index*, NOT a statistical
percentage chance of attack, shipping interruption, flight closure or delay.
The index is based on disclosed indicative weights in logistics-risk.ts,
NOT empirical actuarial calibration. A successful EASA query without a
matching warning yields 10 points of limited evidence, not a safety finding.
An active advisory adds EASA-specific points. Hormuz-exposed maritime
scenarios receive structural 25 points only when AIS/incident data is
available, supplemented by observed AIS traffic decline and reported incidents.
Gulf-internal reference ports do not automatically cross Hormuz. Nearby
GDACS alerts add context. All scores are capped at 100, otherwise N/A.
