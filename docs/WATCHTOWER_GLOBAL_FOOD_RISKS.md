# Global food-security intelligence in Watchtower

The right-hand Food Security & Risk panel is worldwide even when the map stays
in the Qatar/Gulf operations view. These feeds have different meanings:

1. IPC/CH country-level acute food insecurity assessments: official
   Phase 3+ population and validity dates, only countries actually assessed.
   The endpoint is `https://api.ipcinfo.org/country?type=A&format=json`,
   documented at https://docs.api.ipcinfo.org/. If access is denied, configure
   `WATCHTOWER_IPC_API_KEY` in Vercel using the credential supplied by IPC.
   No IPC country centroids or invented field-specific incident coordinates
   are painted on the map.
2. GDACS globally reported red/orange natural hazards: potential crop and
   supply disruption screening, NOT confirmed food insecurity. These are
   mapped by documented event coordinates. Event list and production-risk
   polygons are available worldwide, and clicking an out-of-view event
   automatically focuses the map on it.
3. EASA / UKMTO logistic advisories remain geospatial/contextual separate.
   Organization-specific food ledger is not a national or global indicator.

IPC date, population and share are passed through with no inferred prices,
yield losses, affected production or supply chain probabilities. Missing
IPC access or GDACS feed should produce a visible unavailable status, not
a misleading 'no global risks' state.

Maritime display uses only vessel positions with SOG >=1.5 knots,
observed at most 120 minutes ago, excluding webpage-capture timestamps.
The filter is applied independently of selected vessel category, so
stopped port ships never reappear through another dropdown option.
