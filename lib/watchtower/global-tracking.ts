/** Source-attributed observations. No generated tracks or cargo manifests. */
export type FeedState = 'available' | 'partial' | 'stale' | 'unconfigured' | 'unavailable'
export type TrackingAsset = {
  id: string; kind: 'aircraft' | 'vessel'; label: string; lat: number; lon: number
  heading: number | null; speedKnots: number | null; altitudeFt: number | null
  observedAt: string; source: string; sourceUrl: string; type: string
  cargo: 'operator_inferred' | 'ais_cargo_class' | 'unverified'
  destination: string | null; foodCargoVerified: false
}
export type MapAlert = {
  id: string; kind: 'hazard' | 'aviation' | 'maritime' | 'food'; title: string
  severity: 'high' | 'attention'; lat: number; lon: number
  observedAt: string | null; source: string; sourceUrl: string
  detail: string; locationBasis: string
}
export type TrackingSource = {
  id: string; name: string; state: FeedState; checkedAt: string
  latestObservationAt: string | null; detail: string; url: string
}
export type TrackingSnapshot = {
  generatedAt: string; assets: TrackingAsset[]; alerts: MapAlert[]
  sources: TrackingSource[]; refreshSeconds: number
}
export type MapLayers = { aircraft: boolean; vessels: boolean; risks: boolean; gateways: boolean; trails: boolean; projections: boolean }
export const QATAR = { lat: 25.2854, lon: 51.531, label: 'Qatar / Doha' }
/** Geographic references only, NOT live closure assertions. */
export const CHOKEPOINTS = [
  { label: 'Strait of Hormuz', lat: 26.56, lon: 56.25 },
  { label: 'Bab el-Mandeb', lat: 12.58, lon: 43.33 },
  { label: 'Suez Canal', lat: 30.45, lon: 32.35 },
  { label: 'Strait of Malacca', lat: 2.5, lon: 101.2 },
  { label: 'Panama Canal', lat: 9.08, lon: -79.68 },
  { label: 'Strait of Gibraltar', lat: 35.98, lon: -5.6 },
  { label: 'Bosporus', lat: 41.12, lon: 29.06 },
] as const
export const MAX_ASSETS = 2000
export const REFRESH_SECONDS = 60
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const text = (v: unknown, max = 180): string =>
  typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim().slice(0, max) : ''
const numeric = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}
export function coordinate(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const a = numeric(lat), b = numeric(lon)
  return a !== null && b !== null && Math.abs(a) <= 85 && Math.abs(b) <= 180 ? { lat: a, lon: b } : null
}
export function epoch(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v
  const s = text(v)
  if (!s) return null
  const normalized = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?: UTC)?$/.test(s)
    ? s.replace(' UTC', '').replace(' ', 'T') + 'Z' : s
  const n = Date.parse(normalized)
  return Number.isFinite(n) ? n : null
}
const bearing = (v: unknown) => { const n = numeric(v); return n !== null && n >= 0 && n < 360 ? n : null }
const speed = (v: unknown, max: number) => { const n = numeric(v); return n !== null && n >= 0 && n < max ? n : null }
export function freshAsset(asset: TrackingAsset, now = Date.now()): boolean {
  const age = now - Date.parse(asset.observedAt)
  return age >= -60000 && age <= (asset.kind === 'aircraft' ? 120000 : 600000)
}
export function mergeAssets(assets: readonly TrackingAsset[]): TrackingAsset[] {
  const byId = new Map<string, TrackingAsset>()
  for (const asset of assets) {
    const previous = byId.get(asset.id)
    if (!previous || asset.observedAt > previous.observedAt) byId.set(asset.id, asset)
  }
  return [...byId.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt)).slice(0, MAX_ASSETS)
}
/** Callsign is a freight-operator heuristic, not a confirmed cargo flight. */
export function parseAircraft(raw: unknown, now = Date.now()): TrackingAsset[] {
  const root = record(raw), rows = root.ac ?? root.aircraft, timestamp = epoch(root.now)
  if (!Array.isArray(rows) || timestamp === null) throw Error('Unexpected ADS-B response')
  if (timestamp > now + 60000 || timestamp < now - 3600000) throw Error('Expired ADS-B response')
  return mergeAssets(rows.slice(0, 20000).flatMap((value): TrackingAsset[] => {
    const row = record(value), point = coordinate(row.lat, row.lon)
    const hex = text(row.hex).toLowerCase(), age = numeric(row.seen_pos)
    if (!point || !/^[0-9a-f]{6}$/.test(hex) || age === null || age < 0 || age > 900 || row.alt_baro === 'ground') return []
    const observed = timestamp - age * 1000
    if (now - observed > 900000 || observed > now + 60000) return []
    const label = text(row.flight, 24) || text(row.r, 24) || hex.toUpperCase()
    const freight = /^(FDX|UPS|GTI|CLX|ABW|CKK|ICL|PAC|NCA|MPH|TAY|DHK|BCS|BOX|GEC|CKS|ABR)/.test(label)
    const altitude = numeric(row.alt_baro)
    return [{ id: 'air:' + hex, kind: 'aircraft', label, ...point,
      heading: bearing(row.track), speedKnots: speed(row.gs, 1500),
      altitudeFt: altitude !== null && altitude >= -1500 && altitude <= 65000 ? altitude : null,
      observedAt: new Date(observed).toISOString(), source: 'ADSB.lol',
      sourceUrl: 'https://www.adsb.lol/?icao=' + hex, type: text(row.t, 12),
      cargo: freight ? 'operator_inferred' : 'unverified', destination: null, foodCargoVerified: false }]
  }))
}
/** AIS type 70-79 identifies cargo vessels, not food on board. */
export function parseVessels(raw: unknown, now = Date.now()): TrackingAsset[] {
  if (!Array.isArray(raw)) throw Error('Unexpected AIS response')
  return mergeAssets(raw.slice(0, 50000).flatMap((value): TrackingAsset[] => {
    const row = record(record(value).AIS), point = coordinate(row.LATITUDE, row.LONGITUDE)
    const mmsi = String(row.MMSI ?? ''), type = numeric(row.TYPE), timestamp = epoch(row.TIMESTAMP)
    if (!point || !/^[1-9]\d{8}$/.test(mmsi) || type === null || type < 70 || type >= 80 ||
        timestamp === null || timestamp > now + 60000 || now - timestamp > 1800000) return []
    return [{ id: 'sea:' + mmsi, kind: 'vessel', ...point, label: text(row.NAME, 80) || mmsi,
      heading: bearing(row.HEADING) ?? bearing(row.COURSE), speedKnots: speed(row.SPEED, 102.3), altitudeFt: null,
      observedAt: new Date(timestamp).toISOString(), source: 'VesselFinder',
      sourceUrl: /^[1-9]\d{6}$/.test(String(row.IMO ?? '')) ? 'https://www.vesselfinder.com/vessels/details/' + String(row.IMO) : 'https://www.vesselfinder.com/',
      type: 'AIS cargo class ' + type, cargo: 'ais_cargo_class', destination: text(row.DESTINATION, 80) || null, foodCargoVerified: false }]
  }))
}
export function parseGlobalHazards(raw: unknown, now = Date.now()): MapAlert[] {
  const rows = record(raw).features
  if (!Array.isArray(rows)) throw Error('Unexpected GDACS response')
  const seen = new Map<string, MapAlert>()
  for (const value of rows.slice(0, 1500)) {
    const feature = record(value), p = record(feature.properties), g = record(feature.geometry)
    if (g.type !== 'Point' || !Array.isArray(g.coordinates)) continue
    const point = coordinate(g.coordinates[1], g.coordinates[0])
    const level = text(p.alertlevel ?? p.alertLevel).toLowerCase()
    const start = epoch(p.fromdate ?? p.fromDate), end = epoch(p.todate ?? p.toDate) ?? start
    if (!point || !['red', 'orange'].includes(level) || start === null || end === null ||
        start > now + 86400000 || end < now - 14 * 86400000) continue
    const type = text(p.eventtype ?? p.eventType, 8), id = String(p.eventid ?? p.eventId ?? feature.id ?? '')
    if (!/^[A-Za-z0-9_-]{1,45}$/.test(id) || !/^[A-Z]{2}$/.test(type)) continue
    const key = 'gdacs:' + type + ':' + id
    const alert: MapAlert = { id: key, kind: 'hazard', ...point,
      title: text(p.name ?? p.eventname ?? p.description) || type + ' ' + level + ' alert',
      severity: level === 'red' ? 'high' : 'attention', observedAt: new Date(start).toISOString(),
      source: 'GDACS', sourceUrl: 'https://www.gdacs.org/report.aspx?eventid=' + encodeURIComponent(id) + '&eventtype=' + type,
      detail: 'Reported ' + level + ' hazard. Review nearby producers, ports and cold-chain operations; shipment disruption and losses are not confirmed.',
      locationBasis: 'Reported event point, not the hazard footprint or a confirmed supply interruption.' }
    const previous = seen.get(key)
    if (!previous || (alert.observedAt ?? '') > (previous.observedAt ?? '')) seen.set(key, alert)
  }
  return [...seen.values()].sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1) ||
    (b.observedAt ?? '').localeCompare(a.observedAt ?? '')).slice(0, 120)
}
export function separationKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180, x = (b.lat - a.lat) * r, y = (b.lon - a.lon) * r
  return 12742 * Math.asin(Math.min(1, Math.sqrt(Math.sin(x / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2)))
}
