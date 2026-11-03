# Watchtower maritime coverage (3 November 2026)

## Regional AIS, not a port-scraping sample
The map now consumes the hormuz.now compact AIS snapshot via
`/api/watchtower/hormuz-snapshot` and merges it with existing data-tracking.net
chokepoint observations, licensed VesselFinder if configured, and the optional
MyShipTracking public-port sample. Port-page discovery remains limited to 48
candidates and must not be described as complete coverage.

Source: https://hormuz.now/data
Endpoint: https://hormuz.now/api/snapshot?format=compact
License: CC BY 4.0 (attribute hormuz.now). Its compact schema supplies
`t`, `n`, a `fields` header and `rows`. The `id` column is the
provider's internal vessel ID, **not an MMSI**.

The adapter only maps actual coordinates from provider rows. The last-position
time is derived from provider `ageMin`; it is not independently verified raw
AIS transmission time. Only positions within 24 hours are accepted, and snapshot
freshness is reported separately. Speed over ground >=1.5 kn is a display
filter, never verified voyage history. Vessel class is not food cargo evidence.

Coverage: Persian Gulf / Gulf of Oman. It is NOT a global AIS feed. Counts are
availability dependent and may be well below provider totals when fixes are
older than 24h or missing coordinate/time fields. Empty or unavailable feeds
must be explicitly reported; no simulations or extrapolated positions.

The simplified filter panel has search, geographic view, ship traffic mode,
four layer toggles, and an expandable data-source diagnostic section.
