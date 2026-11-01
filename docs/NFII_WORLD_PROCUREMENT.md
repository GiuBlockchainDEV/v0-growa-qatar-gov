# Worldwide crop-led Procurement discovery

## Scope and guarantees

NFII now offers **249 ISO 3166-1 alpha-2 country/territory choices**. This means
that a country is selectable for research; it does **not** mean that NFII has a
complete supplier registry or a verified producer for each crop and territory.

Request:

`GET /api/nfii/procurement/crop-producers?commodity=tomato&country=MA&research=mapped`

An authenticated user is required. If `organizationId` is supplied,
`supply.view` is checked against that organization. No new database tables,
permissions, supplier approvals, RFQs or orders are created by discovery.

## Sources

1. **Curated source records (`research=curated`)**. Prior FairTSA, trade
   association, Qatar farms and cooperatives, plus dated international farm
   and producer announcements. Each lead includes its crop and original URL.
   International production sites of one corporate group are **not** implied
   to be separate legal companies.
2. **Public mapped crop locations (`research=mapped`, default for selected
   country)**. An OpenStreetMap Overpass request asks for *named* locations
   inside the selected country's administrative area with explicitly tagged
   `crop` or `produce`. Only explicit commodity-tag matches are accepted.
   Results have evidence type `community_mapped_crop_tag`: these are mapped
   locations, NOT necessarily registered supplier businesses. The free public
   Overpass service can be rate-limited, time out, have sparse local coverage
   or be temporarily unavailable. Calls have bounded time and response size;
   failures preserve the curated records and show a source status.
3. **Google Places (`research=places`)**. Two paid, crop-focused text queries
   with the country name and country bias distinguish producer/farm keywords
   from wholesaler/exporter keywords. Only entries whose returned
   `addressComponents` **explicitly** contain the selected country code
   are included; Google `regionCode` alone is not a strict filter.
   Places matches are labelled `keyword_business_listing` and **do not**
   prove the specific crop/product is grown, processed or sold. A key, billing,
   an authenticated NFII session and an authorized `organizationId`
   are mandatory. Configure `GOOGLE_PLACES_API_KEY` on the server only;
   never expose it as `NEXT_PUBLIC_*`.

## Response interpretation

- `results`: curated records plus additional best-effort matches, with
  per-row source URL, evidence type and optional sourcing-role details.
- `documentedCount`: entries from previously collected, source-attributed
  company and association documents.
- `exploratoryCount`: new community-mapped locations or Google keyword leads
  from the specific live query.
- `researchStatus`: `not_requested`, `available`, `no_matches`,
  `not_configured` or `unavailable`. An empty dynamic search is **not**
  interpreted as zero producers in that country.
- `sourceCoverage`: number of *curated* matches per commodity, **not** a
  measure of complete global commercial coverage.

All results remain **unqualified**. In particular,
`cropGrowerConfirmed=false`, `currentCertificateConfirmed=false`,
`exportCapabilityConfirmed=false`, `capacityTonnes=null` and
`supplierApproved=false`. Sector association members, imported-food
wholesalers and mapped agricultural locations are not automatically categorized
as growers.

The commercial and agricultural verification workflow is still manual:
confirm legal entity, crop, country of **production**, annual or seasonal
quantity, export permissions, applicable phytosanitary and quality
documentation, logistics capabilities and a real commercial offer.

## Known limits and further scaling

- OpenStreetMap is geographically broad but **not a supplier directory**.
  Some countries/crops have no explicit tags. Public Overpass infrastructure
  is not suitable for unlimited automated bulk collection.
- Google Places needs a paid and suitably restricted server API key and
  regional data is not a verified origin-of-production register.
- Static curated country coverage remains incomplete. The selection of 249
  territories must not be confused with 249 complete supplier catalogs.
- At production scale, use licensed national exporter lists, association
  member data, approved producer certificate feeds and source-reconciled
  bulk imports with periodic refresh, provider quotas and consent/licensing
  checks. Never manufacture names or invent crops to hit a count.
- Multiple records with equal normalized name/country are merged in the
  response, with previously documented crop evidence preferred over
  exploratory leads. Only signed-in users see the results.

Sources and API references:

- OpenStreetMap Overpass API: https://wiki.openstreetmap.org/wiki/Overpass_API
- Google Places Text Search (New):
  https://developers.google.com/maps/documentation/places/web-service/text-search
- USDA Organic INTEGRITY: https://organic.ams.usda.gov/integrity/
- GLOBALG.A.P. IT platform: https://globalgap.org/what-we-offer/globalgap-it-platform/
