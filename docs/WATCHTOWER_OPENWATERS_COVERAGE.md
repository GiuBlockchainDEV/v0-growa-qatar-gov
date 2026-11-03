# Additional Red Sea / Arabian Sea maritime AIS source

The existing public regional provider hormuz.now only observes the Persian
Gulf and Gulf of Oman. OpenSeaFeed can be unavailable. Neither should be
presented as complete coverage of the Red Sea, Gulf of Aden, Arabian Sea, or
northwestern Indian Ocean.

## Open Waters AIS commercial integration

Server-only REST: `GET https://ais.openwaters.io/v1/vessels?bbox=s,w,n,e`.
The adapter in `lib/watchtower/open-waters-ais.ts` partitions 15
maritime operating zones into <=100-square-degree boxes. Every returned
ship must have an actual GeoJSON coordinate and observed timestamp. The
frontend merges its positions with existing AIS, with a default SOG >=1.5kn
movement filter. Region failures and attribution are surfaced separately.

Open Waters AIS offers anonymous queries for personal use. A Growa product
deployment must first acquire or confirm commercial access and downstream
source licenses, including AISHub contributions. Do not enable merely
because the anonymous endpoint responds.

Enable when authorised:
- `WATCHTOWER_OPENWATERS_COMMERCIAL_APPROVED=true`
- `WATCHTOWER_OPENWATERS_TOKEN=<commercial or contributor token>` if issued

Open Waters: https://openwaters.io/ais/
Terms and credits: https://openwaters.io/api/ais/
Commercial contact: hello@openwaters.io

The endpoint is authenticated using the existing application's user session.
No API key is ever returned to the browser. Source-specific attribution
from each GeoJSON collection is preserved for display.

Important: no provider guarantees offshore satellite AIS. Vessel count zero
with unavailable or unlicensed feed means unknown, not confirmed zero traffic.
