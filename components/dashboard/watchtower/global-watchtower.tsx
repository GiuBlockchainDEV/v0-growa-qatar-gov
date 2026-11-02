'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, ArrowUpRight, ChevronLeft, ExternalLink, Globe2, Layers, Maximize2, Minimize2, Pause, Plane, Play, Radio, RefreshCw, Search, Ship, Wheat, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import type { FoodPosture } from '@/lib/watchtower/food-posture'
import { CHOKEPOINTS, QATAR, REFRESH_SECONDS, freshAsset, separationKm, type MapAlert, type MapLayers, type TrackingAsset, type TrackingSnapshot } from '@/lib/watchtower/global-tracking'
import type { GlobalTrackingMapProps } from './global-tracking-map'
import styles from './global-watchtower.module.css'
const Map = dynamic<GlobalTrackingMapProps>(() => import('./global-tracking-map').then(m => m.GlobalTrackingMap), { ssr: false, loading: () => <div className={styles.map} aria-busy="true" /> })
const REGIONS = {
  global: { name: 'Global', lat: 22, lon: 35, zoom: 2, box: [-85, -180, 85, 180] },
  gulf: { name: 'Gulf & Red Sea', lat: 24, lon: 47, zoom: 4, box: [10, 30, 36, 63] },
  europe: { name: 'Europe', lat: 50, lon: 12, zoom: 4, box: [35, -18, 72, 45] },
  asia: { name: 'Asia', lat: 25, lon: 103, zoom: 3, box: [-12, 45, 75, 180] },
  africa: { name: 'Africa', lat: 2, lon: 22, zoom: 3, box: [-36, -20, 38, 53] },
  americas: { name: 'Americas', lat: 15, lon: -80, zoom: 3, box: [-60, -180, 80, -30] },
} as const
type Region = keyof typeof REGIONS
const count = (n: number | null) => n === null ? 'N/A' : n.toLocaleString('en-US')
function utc(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not provided'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value + ' (date only)'
  return new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' UTC'
}
function age(value: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000))
  return seconds < 60 ? seconds + 's ago' : seconds < 3600 ? Math.floor(seconds / 60) + 'm ago' : Math.floor(seconds / 3600) + 'h ago'
}
export function GlobalWatchtower() {
  const { locale } = useI18n(), { organization } = useOrganization()
  const ar = locale === 'ar', tx = (en: string, arabic: string) => ar ? arabic : en
  const root = useRef<HTMLDivElement>(null), pausedRef = useRef(false)
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null), [posture, setPosture] = useState<FoodPosture | null>(null)
  const [error, setError] = useState(''), [foodError, setFoodError] = useState('')
  const [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0), [paused, setPaused] = useState(false), [now, setNow] = useState(Date.now)
  const [mobile, setMobile] = useState(false), [filtersOpen, setFiltersOpen] = useState(true), [alertsOpen, setAlertsOpen] = useState(true), [fullscreen, setFullscreen] = useState(false)
  const [query, setQuery] = useState(''), [region, setRegion] = useState<Region>('global'), [cargoOnly, setCargoOnly] = useState(true)
  const [commodity, setCommodity] = useState('all'), [alertKind, setAlertKind] = useState('all'), [highOnly, setHighOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null), [sourceId, setSourceId] = useState<string | null>(null)
  const [focus, setFocus] = useState<GlobalTrackingMapProps['focus']>(null)
  const [layers, setLayers] = useState<MapLayers>({ aircraft: true, vessels: true, risks: true, gateways: true, trails: true })
  const orgId = organization?.id ?? null, food = posture?.organizationId === orgId ? posture : null
  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 800px)')
    const resize = () => { setMobile(media.matches); if (media.matches) { setFiltersOpen(false); setAlertsOpen(false) } }
    const screen = () => setFullscreen(document.fullscreenElement === root.current)
    resize(); media.addEventListener('change', resize); document.addEventListener('fullscreenchange', screen)
    const clock = setInterval(() => setNow(Date.now()), 15000)
    return () => { clearInterval(clock); media.removeEventListener('change', resize); document.removeEventListener('fullscreenchange', screen) }
  }, [])
  useEffect(() => {
    let active = true, running = false
    const controller = new AbortController()
    const load = async () => {
      if (running || document.hidden || !active) return
      running = true; setBusy(true)
      try {
        const response = await fetch('/api/watchtower/tracking', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(28000)]) })
        const body = await response.json() as TrackingSnapshot & { error?: string }
        if (!response.ok) throw Error(body.error ?? 'Tracking request failed')
        if (!Array.isArray(body.assets) || !Array.isArray(body.alerts) || !Array.isArray(body.sources)) throw Error('Unexpected tracking response')
        if (active) { setSnapshot(body); setNow(Date.now()); setError('') }
      } catch (reason) { if (active && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Tracking unavailable') }
      finally { running = false; if (active) setBusy(false) }
    }
    void load()
    const timer = setInterval(() => { if (!pausedRef.current) void load() }, REFRESH_SECONDS * 1000)
    const visible = () => { if (!document.hidden && !pausedRef.current) void load() }
    document.addEventListener('visibilitychange', visible)
    return () => { active = false; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible) }
  }, [refresh])
  useEffect(() => {
    setPosture(null); setFoodError(''); setCommodity('all')
    if (!orgId) return
    const controller = new AbortController()
    let running = false
    const load = async () => {
      if (running || document.hidden || controller.signal.aborted) return
      running = true
      try {
        const response = await fetch('/api/watchtower/food-security?' + new URLSearchParams({ organizationId: orgId, days: '30' }), {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(28000)]),
        })
        const body = await response.json() as FoodPosture & { error?: string }
        if (!response.ok) throw Error(body.error ?? 'Food ledger unavailable')
        if (body.organizationId !== orgId || body.scope !== 'organization' || body.sourceMode !== 'live') throw Error('Food ledger scope mismatch')
        if (!controller.signal.aborted) { setPosture(body); setFoodError('') }
      } catch (reason) { if (!controller.signal.aborted) setFoodError(reason instanceof Error ? reason.message : 'Food ledger unavailable') }
      finally { running = false }
    }
    void load()
    const timer = setInterval(() => { if (!pausedRef.current) void load() }, 120000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [orgId, refresh])
  const foodAlerts = useMemo<MapAlert[]>(() => (food?.commodities ?? []).filter(c => ['critical', 'high', 'attention'].includes(c.band)).map(c => ({
    id: 'food:' + c.commodityId, kind: 'food', title: (ar ? c.nameAr : c.name) + ': ' + c.reason.replaceAll('_', ' '),
    severity: c.band === 'attention' ? 'attention' : 'high', lat: QATAR.lat, lon: QATAR.lon,
    observedAt: c.latestReviewedAt, source: 'Organization food ledger',
    sourceUrl: '/dashboard?' + new URLSearchParams({ module: 'commodities', commodityId: c.commodityId, organizationId: food!.organizationId }),
    detail: '30-day organization outlook. Coverage: ' + (c.coverageDays === null ? 'unknown' : c.coverageDays.toFixed(1) + ' days') +
      '. Projected deficit: ' + (c.deficitTonnes === null ? 'unknown' : c.deficitTonnes.toFixed(1) + ' tonnes') + '. Not national totals.',
    locationBasis: 'Organization-level signal anchored to Qatar for navigation, NOT a geolocated incident.',
  })), [food, ar])
  const allAlerts = useMemo(() => [...foodAlerts, ...(snapshot?.alerts ?? [])], [foodAlerts, snapshot])
  const inside = useCallback((p: { lat: number; lon: number }) => {
    const [south, west, north, east] = REGIONS[region].box
    return p.lat >= south && p.lat <= north && p.lon >= west && p.lon <= east
  }, [region])
  const assets = useMemo(() => (snapshot?.assets ?? []).filter(a => inside(a) && (!cargoOnly || a.cargo !== 'unverified') &&
    (!query || (a.label + ' ' + a.id + ' ' + (a.destination ?? '')).toLowerCase().includes(query.toLowerCase()))), [snapshot, inside, cargoOnly, query])
  const alerts = useMemo(() => allAlerts.filter(a => inside(a) && (alertKind === 'all' || a.kind === alertKind) &&
    (!highOnly || a.severity === 'high') && (commodity === 'all' || a.kind !== 'food' || a.id === 'food:' + commodity) &&
    (!query || (a.title + ' ' + a.source).toLowerCase().includes(query.toLowerCase()))), [allAlerts, inside, alertKind, highOnly, commodity, query])
  const selectedAsset = snapshot?.assets.find(a => a.id === selectedId), selectedAlert = allAlerts.find(a => a.id === selectedId)
  const selectedSource = snapshot?.sources.find(s => s.id === sourceId)
  const recentCount = (snapshot?.assets ?? []).filter(a => freshAsset(a, now)).length
  const staleSnapshot = Boolean(snapshot && now - Date.parse(snapshot.generatedAt) > 180000)
  const staleFood = Boolean(food && now - Date.parse(food.generatedAt) > 300000)
  const airSource = snapshot?.sources.find(s => s.id === 'adsb'), seaSource = snapshot?.sources.find(s => s.id === 'ais')
  const known = (state: string | undefined) => state === 'partial' || state === 'available' || state === 'stale'
  const riskReadable = Boolean(food?.assessedCount || snapshot?.sources.some(s => ['gdacs', 'easa', 'hormuz'].includes(s.id) && known(s.state)))
  const select = useCallback((id: string) => { setSelectedId(id); setSourceId(null); setAlertsOpen(true); if (mobile) setFiltersOpen(false) }, [mobile])
  const choose = (item: TrackingAsset | MapAlert) => { select(item.id); setFocus({ lat: item.lat, lon: item.lon, zoom: 5, token: Date.now() }) }
  const setView = (key: Region) => { setRegion(key); setFocus({ ...REGIONS[key], token: Date.now() }) }
  const toggleFull = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current?.requestFullscreen() }
    catch { setError('Fullscreen is unavailable in this browser. The map still fills the Watchtower workspace.') }
  }
  const nearby = selectedAsset ? allAlerts.filter(a => a.kind === 'hazard' && separationKm(a, selectedAsset) <= 350).slice(0, 3) : []
  const nearGateway = selectedAsset ? [...CHOKEPOINTS].sort((a, b) => separationKm(a, selectedAsset) - separationKm(b, selectedAsset))[0] : null
  return <div id="watchtower-map" ref={root} className={styles.shell} dir={ar ? 'rtl' : 'ltr'}>
    <Map assets={assets} alerts={alerts} layers={layers} selectedId={selectedId} onSelect={select} focus={focus} now={now} />
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div><div className={styles.eyebrow}>NFII / GLOBAL OPERATING PICTURE</div>
          <h1>{tx('Food Security Watchtower', '\u0628\u0631\u062c \u0645\u0631\u0627\u0642\u0628\u0629 \u0627\u0644\u0623\u0645\u0646 \u0627\u0644\u063a\u0630\u0627\u0626\u064a')}</h1>
          <p className={styles.subtitle}>Air & maritime observations / Risk intelligence</p></div>
        <div className={styles.actions}>
          <span className={styles.badge} data-state={paused || staleSnapshot || !recentCount ? 'offline' : 'recent'}><i />{paused ? 'PAUSED' : staleSnapshot ? 'STALE' : recentCount ? 'RECENT / 60s' : 'NO RECENT TRACKS'}</span>
          <button className={styles.iconButton} aria-label="Toggle map filters" aria-pressed={filtersOpen} onClick={() => { setFiltersOpen(!filtersOpen); if (mobile) setAlertsOpen(false) }}><Layers size={15} /></button>
          <button className={styles.iconButton} aria-label="Toggle alert panel" aria-pressed={alertsOpen} onClick={() => { setAlertsOpen(!alertsOpen); if (mobile) setFiltersOpen(false) }}><AlertTriangle size={15} /></button>
          <button className={styles.iconButton} aria-label={paused ? 'Resume automatic updates' : 'Pause automatic updates'} onClick={() => setPaused(!paused)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
          <button className={styles.iconButton} aria-label="Refresh observations" disabled={busy} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={14} className={busy ? 'animate-spin' : ''} /></button>
          <button className={styles.iconButton} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={() => void toggleFull()}>{fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
        </div>
      </div>
      <div className={styles.stats}>{[
        { label: 'Aircraft observations', value: known(airSource?.state) ? assets.filter(a => a.kind === 'aircraft').length : null, note: cargoOnly ? 'Freight-operator candidates / sampled' : 'Six airframe samples / not all traffic', icon: Plane },
        { label: 'Cargo vessel observations', value: known(seaSource?.state) ? assets.filter(a => a.kind === 'vessel').length : null, note: seaSource?.state === 'unconfigured' ? 'AIS subscription not connected' : 'Licensed coverage / not global totals', icon: Ship },
        { label: 'Mapped risk reports', value: riskReadable ? alerts.length : null, note: 'Reported hazards & screening signals', icon: AlertTriangle },
        { label: 'Food-security signals', value: food && food.assessedCount > 0 ? foodAlerts.length : null, note: staleFood ? 'Stale organization snapshot' : food ? food.assessedCount + ' commodities assessed / organization' : 'Organization ledger not loaded', icon: Wheat },
      ].map(item => <div key={item.label} className={styles.stat}><label>{item.label}</label><strong>{count(item.value)}</strong><item.icon size={21} /><small>{item.note}</small></div>)}</div>
    </header>
    {error && <div className={styles.statusError} role="alert">{error}</div>}
    <aside className={`${styles.panel} ${styles.filters} ${filtersOpen ? '' : styles.hidePanel}`} aria-label="Map filters">
      <div className={styles.panelTitle}><span>MAP LAYERS & FILTERS</span><button className={styles.iconButton} aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={12} /></button></div>
      <label className={styles.label} htmlFor="watchtower-search"><Search size={11} className="inline" /> Search observations</label>
      <input id="watchtower-search" className={styles.input} value={query} maxLength={100} placeholder="Callsign, vessel, MMSI, alert..." onChange={e => setQuery(e.target.value)} />
      {query && <div className={styles.searchMatches}>{assets.slice(0, 6).map(asset => <button key={asset.id} onClick={() => choose(asset)}>{asset.kind === 'aircraft' ? 'AIR' : 'SEA'} / {asset.label}</button>)}</div>}
      <label className={styles.label} htmlFor="watchtower-region">Geographic view</label>
      <select id="watchtower-region" className={styles.input} value={region} onChange={e => setView(e.target.value as Region)}>{Object.entries(REGIONS).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}</select>
      <div className="mt-2 flex gap-2"><button className={styles.smallButton} onClick={() => setView('global')}><Globe2 size={12} />Global</button><button className={styles.smallButton} onClick={() => { setView('gulf'); setFocus({ ...QATAR, zoom: 6, token: Date.now() }) }}>Qatar</button></div>
      <hr className={styles.divider} />
      {([
        ['aircraft', Plane, 'Aircraft'], ['vessels', Ship, 'Cargo vessels'], ['risks', AlertTriangle, 'Risk reports'], ['gateways', Globe2, 'Strategic chokepoints'], ['trails', Activity, 'Observed track history'],
      ] as const).map(([key, Icon, title]) => <button key={key} className={styles.toggle} aria-pressed={layers[key]} onClick={() => setLayers(current => ({ ...current, [key]: !current[key] }))}><span><Icon size={13} />{title}</span><i className={styles.switch} /></button>)}
      <hr className={styles.divider} />
      <button className={styles.toggle} aria-pressed={cargoOnly} onClick={() => setCargoOnly(!cargoOnly)}><span>Freight operators only</span><i className={styles.switch} /></button>
      <label className={styles.label} htmlFor="watchtower-alert-type">Alert category</label>
      <select id="watchtower-alert-type" className={styles.input} value={alertKind} onChange={e => setAlertKind(e.target.value)}><option value="all">All categories</option><option value="food">Food security</option><option value="hazard">Weather & natural hazards</option><option value="aviation">Aviation advisories</option><option value="maritime">Maritime incident reports</option></select>
      <button className={styles.toggle} aria-pressed={highOnly} onClick={() => setHighOnly(!highOnly)}><span>High signals only</span><i className={styles.switch} /></button>
      <label className={styles.label} htmlFor="watchtower-commodity">Food commodity</label>
      <select id="watchtower-commodity" className={styles.input} value={commodity} disabled={!food} onChange={e => setCommodity(e.target.value)}><option value="all">All commodities</option>{food?.commodities.map(c => <option key={c.commodityId} value={c.commodityId}>{ar ? c.nameAr : c.name}</option>)}</select>
      <p className={styles.hint}>Commodity filtering applies to organization signals, not cargo manifests. Dashed trails connect observations received in this session.</p>
    </aside>
    <div className={styles.feedDock} aria-label="Tracking source status">{snapshot?.sources.map(source => <button key={source.id} className={styles.feedPill} data-state={source.state} onClick={() => { setSourceId(source.id); setSelectedId(null); setAlertsOpen(true); if (mobile) setFiltersOpen(false) }}><i />{source.name}: {source.state}</button>)}</div>
    <aside className={`${styles.panel} ${styles.alertPanel} ${alertsOpen ? '' : styles.hidePanel}`} aria-label="Alerts and selected observation">
      <div className={styles.panelTitle}><span>{selectedSource ? 'SOURCE STATUS' : selectedId ? 'OBSERVATION DETAILS' : 'FOOD SECURITY & RISK'}</span><button className={styles.iconButton} aria-label={selectedId || sourceId ? 'Back to alerts' : 'Close alert panel'} onClick={() => { if (selectedId || sourceId) { setSelectedId(null); setSourceId(null) } else setAlertsOpen(false) }}>{selectedId || sourceId ? <ChevronLeft size={12} /> : <X size={12} />}</button></div>
      <div className={styles.scroll}>
        {selectedSource ? <div className={styles.details}><Radio size={24} /><h2>{selectedSource.name}</h2><span className={styles.severity}>{selectedSource.state}</span><p className="mt-3">{selectedSource.detail}</p><div className={styles.detailGrid}><div><span>Last checked</span><strong>{utc(selectedSource.checkedAt)}</strong></div><div><span>Latest observation</span><strong>{utc(selectedSource.latestObservationAt)}</strong></div></div><a href={selectedSource.url} target="_blank" rel="noopener noreferrer">Provider documentation <ExternalLink size={11} className="inline" /></a><p className={styles.notice}>Unavailable coverage means unknown traffic or risk, not zero. Refreshing the screen does not make an old observation live.</p></div>
        : selectedAsset ? <div className={styles.details}>
          {selectedAsset.kind === 'aircraft' ? <Plane size={25} /> : <Ship size={25} />}<h2>{selectedAsset.label}</h2>
          <span className={styles.severity}>{freshAsset(selectedAsset, now) ? 'RECENT OBSERVATION' : 'STALE POSITION'}</span>
          <div className={styles.detailGrid}>{[
            ['Identifier', selectedAsset.id.split(':')[1]], ['Last observed', age(selectedAsset.observedAt, now)], ['Type', selectedAsset.type || 'Unknown'],
            ['Speed', selectedAsset.speedKnots === null ? 'Unknown' : selectedAsset.speedKnots.toFixed(1) + ' kn'],
            ['Heading', selectedAsset.heading === null ? 'Unknown' : selectedAsset.heading.toFixed(0) + ' deg'],
            [selectedAsset.kind === 'aircraft' ? 'Altitude' : 'AIS destination', selectedAsset.kind === 'aircraft' ? (selectedAsset.altitudeFt === null ? 'Unknown' : selectedAsset.altitudeFt.toLocaleString() + ' ft') : selectedAsset.destination ?? 'Not reported'],
          ].map(([title, value]) => <div key={title}><span>{title}</span><strong>{value}</strong></div>)}</div>
          <p>{selectedAsset.lat.toFixed(4)}, {selectedAsset.lon.toFixed(4)} / {utc(selectedAsset.observedAt)}</p>
          <p className={styles.notice}>{selectedAsset.cargo === 'ais_cargo_class' ? 'AIS class identifies a cargo vessel.' : selectedAsset.cargo === 'operator_inferred' ? 'Freight-operator callsign heuristic, not a verified cargo manifest.' : 'Aircraft type alone does not confirm a cargo flight.'} Food cargo, supplier and purchase-order linkage are unverified.</p>
          {nearGateway && separationKm(selectedAsset, nearGateway) < 600 && <p>Reference proximity: {nearGateway.label}, approximately {Math.round(separationKm(selectedAsset, nearGateway))} km. Not evidence of crossing or disruption.</p>}
          {nearby.map(alert => <button key={alert.id} className={styles.alert} onClick={() => choose(alert)}><strong>{alert.title}</strong><p>Reported point within 350 km. Proximity only, not confirmed impact.</p></button>)}
          <a href={selectedAsset.sourceUrl} target="_blank" rel="noopener noreferrer">{selectedAsset.source} <ExternalLink size={11} className="inline" /></a>
        </div> : selectedAlert ? <div className={styles.details}>
          <span className={styles.severity} data-level={selectedAlert.severity}>{selectedAlert.severity}</span><h2>{selectedAlert.title}</h2><p>{selectedAlert.detail}</p>
          <div className={styles.detailGrid}><div><span>Source</span><strong>{selectedAlert.source}</strong></div><div><span>Reported / reviewed</span><strong>{utc(selectedAlert.observedAt)}</strong></div></div>
          <p className={styles.notice}>{selectedAlert.locationBasis}</p>
          <a href={selectedAlert.sourceUrl} target={selectedAlert.sourceUrl.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer">Review source evidence <ArrowUpRight size={12} className="inline" /></a>
          <p className={styles.hint}>Operational impact requires a matching supplier, commodity and shipment. No disruption probability or automatic rerouting is asserted.</p>
          <Link className={styles.smallButton} href="/dashboard/logistics">Compare logistics <ArrowUpRight size={12} /></Link>
        </div> : selectedId ? <p className={styles.empty}>This observation is no longer in the current feed. Return to alerts or search for another asset.</p> : <>
          <p className={styles.hint}>{organization?.name ?? 'No organization selected'} / 30-day food outlook. Public hazards are context, not confirmed supply disruptions.</p>
          {foodError && <p className={styles.notice}>{foodError}</p>}
          {staleFood && <p className={styles.notice}>Food ledger snapshot is stale. Review source dates before acting.</p>}
          {!orgId && <p className={styles.notice}>Select an organization to load its reviewed food-security signals.</p>}
          {(staleSnapshot || paused) && <p className={styles.notice}>{paused ? 'Automatic updates paused. Positions will age.' : 'Tracking snapshot is stale. Source availability may have changed.'}</p>}
          <div className="mt-3">{alerts.map(alert => <button key={alert.id} className={styles.alert} onClick={() => choose(alert)}><div className={styles.alertHead}><span className={styles.severity} data-level={alert.severity}>{alert.severity}</span><small>{alert.source}</small></div><strong>{alert.title}</strong><p>{alert.kind === 'food' ? 'Organization-level signal' : alert.kind === 'aviation' ? 'Advisory / not a verified closure' : alert.kind === 'maritime' ? 'Regional report / position approximate' : 'Reported hazard / impact unverified'}</p></button>)}</div>
          {!alerts.length && <p className={styles.empty}>{busy ? 'Loading source-backed observations...' : 'No matching mapped reports in this response. Missing feeds are not evidence that a corridor is safe.'}</p>}
        </>}
      </div>
    </aside>
    <div className={styles.legend}><span><Plane size={12} color="var(--growa-sage)" />Aircraft</span><span><Ship size={12} color="var(--growa-ink-600)" />Cargo vessel</span><span><AlertTriangle size={12} color="var(--warning-strong)" />Reported risk</span><span>Faded = stale</span></div>
    <footer className={styles.footer}><span>{busy ? 'UPDATING SOURCES' : snapshot ? 'SNAPSHOT ' + utc(snapshot.generatedAt) : 'CONNECTING TO SOURCES'} / {paused ? 'PAUSED' : 'AUTO 60s'}</span><span>ESRI WORLD IMAGERY · ADSB.lol / ODbL 1.0 · AIS licensed area · No simulated traffic</span></footer>
  </div>
}
