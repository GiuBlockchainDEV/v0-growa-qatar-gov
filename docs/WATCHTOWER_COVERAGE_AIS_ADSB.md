# Watchtower full screenshot coverage: Egypt to Pakistan
Geographic monitoring rectangle: 7-42 degrees north, 25-80 degrees east.
This includes Egypt, the Red Sea, Gulf of Aden, Arabian Peninsula, Iraq,
Iran, Pakistan and adjacent waters. Map area coverage is distinct from
the existence of real source observations.

## Aviation
ADSB.lol /v2/lat/{lat}/lon/{lon}/dist/250: first 10 dedicated hub queries
(Riyadh, Sana'a, Muscat, Jeddah, Aden, Dammam, Salalah, Abha, Jazan and
Duqm), followed by the original 60 geographic circles on a 6x10 grid.
The largest distance from a grid point to a sample point in the requested
box is below 250 nautical miles. Fourteen cached server batches of five geographic queries,
two browser batch requests in parallel, with five serialized provider queries
per batch. Five-minute client update, two-minute clean-batch cache and
shorter retry on partial source errors. ADSB.lol applies dynamic rate limits;
not all hub requests will necessarily succeed.
Every aircraft must have a real source-observed position and timestamp.
A successful circle query does not guarantee ADS-B receiver coverage.

## Maritime
OpenSeaFeed /v1/snapshot is filtered over the whole screenshot rectangle
and is supplemented by the regional hormuz.now feed, data-tracking.net,
and an optional licensed VesselFinder feed. Public provider coverage
is incomplete; a blank area is unknown, not proof of zero traffic.
The real AIS map shows only source-observed vessels reporting at least 5.1 knots.
Ships below 5.1 knots and vessels with unknown speeds are hidden in every real
AIS mode, including cargo-class view. Genuine individual position timestamps
must be within the last hour. Delayed Bab el-Mandeb AIS fixes are excluded.
AIS vessel class and SOG do not verify contents, voyages or food shipments.
Aircraft display no green past-position trails or origin-to-fix tail lines;
the destination reference may still be shown when available.

## Operations and rights
No real AIS positions, actual routes or maritime coverage are fabricated.
Illustrative scenario markers are generated separately, explicitly identified
as synthetic in Map Controls, and never used in operational data.
Attribution: ADSB.lol ODbL 1.0; hormuz.now and data-tracking.net CC BY 4.0;
other providers under their own terms. All provider requests are cached
and bounded, with failures visible independently in source diagnostics.

## One-hour real AIS versus optional demo ships
The operational map now requires an individual source-dated fix no older than
60 minutes, a speed of at least 5.1 knots, and no page-capture or poll-only
pseudo-timestamp. The old seven-day Bab el-Mandeb last-known exception is
removed. Underserved regions (Red Sea, Gulf of Aden, Arabian Sea and Karachi offshore)
have a separate, explicitly identified synthetic scenario layer in Map Controls,
with fixed illustrative positions and no fake MMSI or AIS timestamps. Scenario
markers have no AIS speed; the real-AIS 5.1-kn threshold is not applied to them.
Each demo marker is non-interactive, is never stored as a TrackingAsset, and
never enters real counts, routes, historical tracks or risk/intelligence outputs.
Demo markers can be toggled off in Map Controls. They are not a fallback AIS
feed or evidence of vessels at these coordinates.
