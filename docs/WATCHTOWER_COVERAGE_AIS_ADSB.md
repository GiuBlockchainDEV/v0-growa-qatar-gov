# Watchtower full screenshot coverage: Egypt to Pakistan
Geographic monitoring rectangle: 7-42 degrees north, 25-80 degrees east.
This includes Egypt, the Red Sea, Gulf of Aden, Arabian Peninsula, Iraq,
Iran, Pakistan and adjacent waters. Map area coverage is distinct from
the existence of real source observations.

## Aviation
ADSB.lol /v2/lat/{lat}/lon/{lon}/dist/250, with 60 circles on a 6x10 grid.
The largest distance from a grid point to a sample point in the requested
box is below 250 nautical miles. Six independent cached server batches,
two concurrent browser requests, five concurrent upstream source requests
per batch. Five-minute client update, two-minute server cache.
Every aircraft must have a real source-observed position and timestamp.
A successful circle query does not guarantee ADS-B receiver coverage.

## Maritime
OpenSeaFeed /v1/snapshot is filtered over the whole screenshot rectangle
and is supplemented by the regional hormuz.now feed, data-tracking.net,
and an optional licensed VesselFinder feed. Public provider coverage
is incomplete; a blank area is unknown, not proof of zero traffic.
The map shows only source-observed vessels with valid AIS speed at least 3 knots.
Ships below 3 knots and unknown-speed vessels are always hidden, including in
cargo-class view. Most positions expire from the map after 12 hours.
When the public Bab el-Mandeb feed is delayed, up to seven-day-old last-known
source-dated positions may be shown only as faded, explicitly stale observations.
Their timestamp is preserved; they are not live ship positions.
AIS vessel class and SOG do not verify contents, voyages or food shipments.
Aircraft display no green past-position trails or origin-to-fix tail lines;
the destination reference may still be shown when available.

## Operations and rights
No positions, movement, AIS routes or maritime coverage are generated.
Attribution: ADSB.lol ODbL 1.0; hormuz.now and data-tracking.net CC BY 4.0;
other providers under their own terms. All provider requests are cached
and bounded, with failures visible independently in source diagnostics.
