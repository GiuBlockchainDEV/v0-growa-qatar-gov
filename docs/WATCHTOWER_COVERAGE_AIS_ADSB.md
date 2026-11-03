# Watchtower maritime and aviation live observations

Maritime feeds (do not simulate missing positions):
- hormuz.now: live AIS snapshot for Persian Gulf / Gulf of Oman only, CC BY 4.0.
- data-tracking.net: partial chokepoint coverage Hormuz / Bab el-Mandeb.
- OpenSeaFeed: geographically incomplete open global receiver-network AIS snapshot.
  Source: https://openseafeed.com/docs and https://api.openseafeed.com/v1/snapshot.
  If unavailable, the UI reports the gap rather than displaying synthetic ships.
- MyShipTracking public pages: opt-in sample of at most 48 port-linked observations;
  most are stationary, timestamps are not always verified.
- Licensed VesselFinder remains optional for organizations that have a key.

Defaults: show only vessel positions with reported SOG >= 1.5 kn. "Underway" here
means speed over ground at that instant, not proof of an itinerary or food cargo.
The user can switch to all observed vessels, cargo-class, or moving cargo-class.

Aviation: ADSB.lol geographical 250 NM radius samples across the
Gulf, northern/central/southern Red Sea, Arabian Sea and Gulf of Aden.
The default is ALL observed non-ground aircraft; freight-operator callsigns
can be filtered separately. ADS-B receiver coverage and producer rate limits
prevent an authoritative global count. Source and ODbL attribution:
https://api.adsb.lol/docs.

Provider requests are cached, bounded and run independently. The map's source
panel shows reported area coverage and explicit unavailable status.
