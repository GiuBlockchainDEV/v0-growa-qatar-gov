# Growa Qatar Watchtower | God's Eye inspired integrations

This implementation is a **Growa-specific** Next.js integration inspired by the
interactive geospatial patterns of [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view).
It is not a copy of that application's Vite server or a guarantee of complete
worldwide sensor coverage.

## Implemented

| Feature | Provider | Integration | Coverage / limitations |
| --- | --- | --- | --- |
| 2D operational map | Esri + Leaflet | Existing default; retains hazards, AIS/ADS-B observations, risks, source and route explanations | Political basemap, not live satellite imagery |
| 3D globe | CesiumJS + Esri imagery | Optional header toggle; follows map focus, 3D aircraft/vessel observed coordinates, optional terrain from Cesium ion | Front-end CDN loaded on demand. No onboard video or live video from space |
| Aviation | OpenSky OAuth2 | Server-only client_credentials exchange with cached bearer; existing regional aircraft observations | Regional bounding box; source credit limits, license restrictions apply; cargo not verified |
| AIS direct sample | AISStream.io | Server-only key; bounded 8.5-second WebSocket sample every 5 minutes on an active Watchtower page | NOT persistent collection, never a complete vessel inventory. Multiple Vercel instances can contend for the same AIS key |
| Wildfire satellite observations | NASA FIRMS VIIRS | Server-only key; 3 NRT VIIRS satellites, last-day regional source reads, 15-minute cache, up to 900 hotspots | 25E–85E, 0N–46N, detections are NOT verified fire perimeters, losses or certainty of wildfire |
| Fixed ground webcams | Windy Webcams API v3 | Existing authenticated proximity search and provider player | Only independently available land cameras; neither aircraft nor vessel onboard footage |

## Environment variables

```dotenv
AISSTREAM_API_KEY=                         # server only
OPENSKY_CLIENT_ID=                         # server only
OPENSKY_CLIENT_SECRET=                     # server only
NASA_FIRMS_MAP_KEY=                        # server only
NEXT_PUBLIC_CESIUM_ION_ACCESS_TOKEN=       # public browser token
WINDY_WEBCAMS_API_KEY=                     # server only, existing Watchtower name
```

Cesium requires the standard public-token restrictions appropriate to this
deployment. The public token is visible in browser scripts by design; restrict
allowed domains, asset access and quotas in Cesium ion. NASA FIRMS MAP_KEY is
never included in errors, logs or returned data. Windy Webcams access requires
a **Webcams API** credential rather than an unrelated Windy API key.

Provider licenses and usage entitlements require independent review for a
national/government or commercial deployment. In particular, OpenSky's public
aircraft observations are not unrestricted commercial telemetry, and 3D
imagery/terrain access is subject to Esri and Cesium terms. Do not remove
attributions.

## AISStream architecture warning

AISStream is a streaming WebSocket, not a historical REST inventory.
An on-demand Vercel sample can visibly improve short-term ship coverage, but
it **cannot** replace a permanently running collector. For a true continuous
national watchtower, host **one** persistent AISStream consumer on a service
such as Azure Container Apps, store timestamped deduplicated MMSI fixes in an
approved database, and expose a rate-limited, authenticated snapshot endpoint
to the Next.js application. Source permissions and retention rules must be
settled first. Never use one WebSocket per browser or one per serverless request
as the primary production collector.

## Observability and semantics

- Source-specific states explicitly distinguish unavailable, unconfigured
  and partially received data.
- Ship positions require real MMSI, coordinates and reported movement:
  `SOG >= 5.1 kn` in the existing displayed-vessel filter.
- `AISStream.io (short sample)` labels received reports; source time may be
  unavailable and then the application labels the receipt time as a poll
  snapshot, not a confirmed broadcast timestamp.
- FIRMS detections are **satellite thermal anomalies**, not verified wildfires,
  fire perimeters or agricultural damage estimates.
- The globe renders positions and annotations from source data. It does
  **not** purport to be real-time satellite surveillance or a target camera.
- If Cesium cannot load, the user can always switch back to the existing Esri
  map. Optional data providers do not block independent sources.

## Verification

Run `npx tsc --noEmit`, the focused Watchtower tests, `npm run build`
and changed-code lint via the separate Watchtower integration workflow.
Existing historical snapshot assertions in the older NFII CI may fail for
reasons unrelated to this change; keep those failures visible.
