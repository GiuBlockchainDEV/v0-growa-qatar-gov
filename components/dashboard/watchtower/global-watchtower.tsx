'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowUpRight, ChevronLeft, ExternalLink, Layers, Maximize2, Minimize2, Pause, Plane, Play, Radio, RefreshCw, Search, Ship, Wheat, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import type { FoodPosture } from '@/lib/watchtower/food-posture'
import type {ProductionRiskSnapshot,ProductionRiskZone} from '@/lib/watchtower/production-risk'
import { CHOKEPOINTS, QATAR, REFRESH_SECONDS, freshAsset, mergeAssets, separationKm, type MapAlert, type MapLayers, type TrackingAsset, type TrackingSnapshot } from '@/lib/watchtower/global-tracking'
import {TRACKED_CHOKEPOINTS,type ChokepointId,type DataTrackingSnapshot} from '@/lib/watchtower/data-tracking-net'
import type {AISRoute,HistoryOverlay} from '@/lib/watchtower/data-tracking-history'
import {MONITORED_MARITIME_PORTS,type GccRadarSnapshot} from '@/lib/watchtower/myshiptracking-gcc-shared'
import type {HormuzNowFeed} from '@/lib/watchtower/hormuz-now'
import type {OpenSeaFeedSnapshot} from '@/lib/watchtower/openseafeed'
import type {OpenWatersSnapshot} from '@/lib/watchtower/open-waters-ais'
import {visibleUnderwayVessel} from '@/lib/watchtower/visible-vessels'
import type {IpcRiskSnapshot} from '@/lib/watchtower/ipc-food-security'
import {REGIONAL_AIR_BATCH_COUNT,type RegionalAirBatch} from '@/lib/watchtower/regional-air-shared'
import {REGIONAL_WATCHTOWER_VIEW} from '@/lib/watchtower/map-viewport'
import type { GlobalTrackingMapProps } from './global-tracking-map'
import {mergeTrackingUpdate,mergeFlightItineraries,type RouteLookupResponse} from '@/lib/watchtower/tracking-merge'
import styles from './global-watchtower.module.css'
const Map = dynamic<GlobalTrackingMapProps>(() => import('./global-tracking-map').then(m => m.GlobalTrackingMap), { ssr: false, loading: () => <div className={styles.map} aria-busy="true" /> })
const REGIONS = {
  global: { name: 'Global', lat: 22, lon: 35, zoom: 2, box: [-85, -180, 85, 180] },
  gulf: { name: 'Gulf · Red Sea · Gulf of Aden', ...REGIONAL_WATCHTOWER_VIEW },
  qatar: { name: 'Qatar waters', lat: 25.35, lon: 51.75, zoom: 6.5, box: [22.5, 49, 28.5, 57] },
  hormuz: { name: 'Strait of Hormuz', lat: 26.2, lon: 56.25, zoom: 6, box: [22.4, 52, 30.3, 62] },
  europe: { name: 'Europe', lat: 50, lon: 12, zoom: 4, box: [35, -18, 72, 45] },
  asia: { name: 'Asia', lat: 25, lon: 103, zoom: 3, box: [-12, 45, 75, 180] },
  africa: { name: 'Africa', lat: 2, lon: 22, zoom: 3, box: [-36, -20, 38, 53] },
  americas: { name: 'Americas', lat: 15, lon: -80, zoom: 3, box: [-60, -180, 80, -30] },
} as const
type Region = keyof typeof REGIONS
type ShipView = 'moving' | 'cargoMoving'
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
  const [productionRisk,setProductionRisk]=useState<ProductionRiskSnapshot|null>(null)
  const [,setProductionError]=useState('')
  const [maritimeFeed,setMaritimeFeed]=useState<DataTrackingSnapshot|null>(null)
  const [openSea,setOpenSea]=useState<HormuzNowFeed|null>(null)
  const [openSeaError,setOpenSeaError]=useState('')
  const [globalAis,setGlobalAis]=useState<OpenSeaFeedSnapshot|null>(null)
  const [globalAisError,setGlobalAisError]=useState('')
  const [openWaters,setOpenWaters]=useState<OpenWatersSnapshot|null>(null)
  const [openWatersError,setOpenWatersError]=useState('')
  const [freightFlightsOnly,setFreightFlightsOnly]=useState(false)
  const [regionalAir,setRegionalAir]=useState<RegionalAirBatch[]>([])
  const [regionalAirLoading,setRegionalAirLoading]=useState(false)
  const [regionalAirFailedBatches,setRegionalAirFailedBatches]=useState<number[]>([])
  const [maritimeError,setMaritimeError]=useState('')
  const [aisHistory,setAISHistory]=useState<AISRoute[]>([])
  const [aisHistoryStatus,setAISHistoryStatus]=useState('')
  const [gccRadar,setGccRadar]=useState<GccRadarSnapshot|null>(null)
  const [gccRadarError,setGccRadarError]=useState('')
  const [error, setError] = useState(''), [, setFoodError] = useState('')
  const [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0), [paused, setPaused] = useState(false), [now, setNow] = useState(Date.now)
  const [mobile, setMobile] = useState(false), [filtersOpen, setFiltersOpen] = useState(true), [alertsOpen, setAlertsOpen] = useState(true), [fullscreen, setFullscreen] = useState(false)
  const [query, setQuery] = useState(''), [region, setRegion] = useState<Region>('gulf')
  const [shipView,setShipView]=useState<ShipView>('moving')
  const [ipcRisk,setIpcRisk]=useState<IpcRiskSnapshot|null>(null)
  const [ipcError,setIpcError]=useState('')
  const [riskPanelFilter,setRiskPanelFilter]=useState<'all'|'ipc'|'hazards'|'logistics'>('all')
  const [selectedIpcId,setSelectedIpcId]=useState<string|null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null), [sourceId, setSourceId] = useState<string | null>(null)
  const [focus, setFocus] = useState<GlobalTrackingMapProps['focus']>(null)
  const [layers, setLayers] = useState<MapLayers>({ aircraft: true, vessels: true, risks: true, production: true, gateways: true, trails: true, projections: true })
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
    let active=true,running=false
    const controller=new AbortController()
    const request=async(stage:'quick'|'full')=>{
      const response=await fetch('/api/watchtower/tracking?stage='+stage,{
        cache:'no-store',
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(stage==='quick'?11500:28000)]),
      })
      const body=await response.json() as TrackingSnapshot & {error?:string}
      if(!response.ok)throw Error(body.error??'Tracking request failed')
      if(!Array.isArray(body.assets)||!Array.isArray(body.alerts)||!Array.isArray(body.sources))
        throw Error('Unexpected tracking response')
      if(active){
        setSnapshot(previous=>mergeTrackingUpdate(previous,body,stage))
        setNow(Date.now())
        setError('')
      }
      return body
    }
    const enrich=async()=>{
      try{
        const response=await fetch('/api/watchtower/routes',{
          cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12500)]),
        })
        if(!response.ok)return
        const result=await response.json() as RouteLookupResponse
        if(active&&result&&typeof result.routes==='object')
          setSnapshot(previous=>mergeFlightItineraries(previous,result))
      }catch{ /* never delay or hide aircraft because an itinerary provider failed */ }
    }
    const load=async()=>{
      if(running||document.hidden||!active)return
      running=true;setBusy(true)
      // Fast plane positions, full hazard/maritime feed and route enrichment
      // run independently. None blocks another category from rendering.
      const quick=request('quick')
      const full=request('full')
      try{
        await quick
        if(active){setBusy(false);void enrich()}
      }catch(reason){
        if(active&&!controller.signal.aborted)
          setError(reason instanceof Error?reason.message:'Aircraft feed unavailable')
      }
      // Full feed may still be working. It never blocks the first plane render.
      try{await full}catch(reason){
        if(active&&!controller.signal.aborted)
          setError(reason instanceof Error?reason.message:'Supplemental tracking unavailable')
      }
      running=false
      if(active)setBusy(false)
    }
    void load()
    const timer=setInterval(()=>{if(!pausedRef.current)void load()},REFRESH_SECONDS*1000)
    const visible=()=>{if(!document.hidden&&!pausedRef.current)void load()}
    document.addEventListener('visibilitychange',visible)
    return()=>{
      active=false;controller.abort();clearInterval(timer)
      document.removeEventListener('visibilitychange',visible)
    }
  }, [refresh])
  // Query the complete screenshot rectangle in independent, bounded batches.
  // Query geometry covers the area; receiver availability remains source dependent.
  useEffect(()=>{
    let active=true,running=false
    const controller=new AbortController()
    const load=async()=>{
      if(!active||document.hidden||pausedRef.current||running)return
      running=true
      setRegionalAirLoading(true)
      try{
        for(let start=0;start<REGIONAL_AIR_BATCH_COUNT;start+=2){
          if(!active||controller.signal.aborted)break
          const fetched=await Promise.allSettled([start,start+1]
            .filter(index=>index<REGIONAL_AIR_BATCH_COUNT)
            .map(async index=>{
              const response=await fetch('/api/watchtower/regional-air?batch='+index,{
                cache:'no-store',
                signal:AbortSignal.any([controller.signal,AbortSignal.timeout(26000)]),
              })
              if(!response.ok)throw Error('Regional ADS-B batch '+index+' HTTP '+response.status)
              const data=await response.json() as RegionalAirBatch
              if(data.source!=='ADSB.lol regional grid'||data.batch!==index||
                !Array.isArray(data.assets))throw Error('Invalid ADS-B batch '+index)
              return data
            }))
          if(!active)break
          for(const [offset,entry] of fetched.entries()){
            const index=start+offset
            if(entry.status==='fulfilled'){
              setRegionalAirFailedBatches(current=>current.filter(n=>n!==index))
              setRegionalAir(current=>[...current.filter(item=>item.batch!==entry.value.batch),
                entry.value].sort((a,b)=>a.batch-b.batch))
            }else{
              setRegionalAirFailedBatches(current=>[...new Set([...current,index])].sort((a,b)=>a-b))
            }
          }
        }
      }finally{
        running=false
        if(active)setRegionalAirLoading(false)
      }
    }
    void load()
    const interval=setInterval(()=>void load(),300000)
    const visible=()=>{if(!document.hidden)void load()}
    document.addEventListener('visibilitychange',visible)
    return()=>{active=false;controller.abort();clearInterval(interval)
      document.removeEventListener('visibilitychange',visible)}
  },[refresh])
  // IPC assessments cover assessed countries worldwide. Their aggregate
  // country records have no precise event coordinates and stay in the panel.
  useEffect(()=>{
    let active=true
    const controller=new AbortController()
    const load=async()=>{
      if(!active||document.hidden||pausedRef.current)return
      try{
        const response=await fetch('/api/watchtower/ipc-food-security',{
          cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(18000)]),
        })
        if(!response.ok)throw Error('IPC HTTP '+response.status)
        const data=await response.json() as IpcRiskSnapshot
        if(data.source!=='IPC/CH acute food insecurity'||!Array.isArray(data.risks))
          throw Error('Unexpected IPC assessment response')
        if(active){setIpcRisk(data);setIpcError('')}
      }catch(error){
        if(active&&!controller.signal.aborted)
          setIpcError(error instanceof Error?error.message:'IPC assessment unavailable')
      }
    }
    void load()
    const timer=setInterval(()=>void load(),30*60000)
    return()=>{active=false;controller.abort();clearInterval(timer)}
  },[refresh])
  // Separate feed: risk geometry does not block aircraft positions or AIS.
  // A source failure stays visible, never silently interpreted as safety.
  useEffect(()=>{
    let active=true
    const controller=new AbortController()
    const load=async()=>{
      if(document.hidden||!active)return
      try{
        const response=await fetch('/api/watchtower/production-risks',{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(27000)]),
        })
        if(!response.ok)throw Error('Agricultural risk feed unavailable')
        const data=await response.json() as ProductionRiskSnapshot
        if(!Array.isArray(data.zones))throw Error('Invalid geographic risk response')
        if(active){setProductionRisk(data);setProductionError('')}
      }catch{
        if(active&&!controller.signal.aborted)
          setProductionError('Production risk areas temporarily unavailable. This does not mean no risk.')
      }
    }
    void load()
    const interval=setInterval(()=>{if(!pausedRef.current)void load()},20*60000)
    return()=>{active=false;controller.abort();clearInterval(interval)}
  },[refresh])
  // Independent regional AIS source. This is a fleet snapshot of actual
  // source-published fixes, not a port-page discovery sample.
  useEffect(()=>{
    let active=true
    const controller=new AbortController()
    const load=async()=>{
      if(!active||document.hidden||pausedRef.current)return
      try{
        const response=await fetch('/api/watchtower/hormuz-snapshot',{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(22000)]),
        })
        if(!response.ok)throw Error('Regional AIS HTTP '+response.status)
        const body=await response.json() as HormuzNowFeed
        if(body.source!=='hormuz.now'||!Array.isArray(body.assets))throw Error('Invalid regional AIS response')
        if(active){
          setOpenSea(body)
          setOpenSeaError(body.state==='unavailable'?body.detail:'')
          console.info('[Watchtower][AIS] hormuz.now',body.state,{
            providerVessels:body.providerCount,mapped:body.acceptedCount,
            moving:body.movingCount,cargoClass:body.cargoCount,sourceAt:body.providerAt,
          })
        }
      }catch(reason){
        if(active&&!controller.signal.aborted){
          setOpenSeaError(reason instanceof Error?reason.message:'Regional AIS feed unavailable')
          console.warn('[Watchtower][AIS] hormuz.now unavailable',reason)
        }
      }
    }
    void load()
    const interval=setInterval(()=>void load(),90000)
    const visible=()=>{if(!document.hidden)void load()}
    document.addEventListener('visibilitychange',visible)
    return()=>{active=false;controller.abort();clearInterval(interval)
      document.removeEventListener('visibilitychange',visible)}
  },[refresh])
  // OpenSeaFeed regional/global AIS is independent from port-page sampling.
  // Report missing geographical coverage instead of inventing ship positions.
  useEffect(()=>{
    let active=true
    const controller=new AbortController()
    const load=async()=>{
      if(!active||document.hidden||pausedRef.current)return
      try{
        const res=await fetch('/api/watchtower/open-ais',{
          cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(26000)]),
        })
        if(!res.ok)throw Error('OpenSeaFeed HTTP '+res.status)
        const body=await res.json() as OpenSeaFeedSnapshot
        if(body.source!=='OpenSeaFeed AIS'||!Array.isArray(body.assets))throw Error('Invalid global AIS response')
        if(active){setGlobalAis(body);setGlobalAisError(body.state==='unavailable'?body.detail:'')}
      }catch(error){
        if(active&&!controller.signal.aborted)setGlobalAisError(
          error instanceof Error?error.message:'OpenSeaFeed unavailable')
      }
    }
    void load()
    const timer=setInterval(()=>void load(),120000)
    const visible=()=>{if(!document.hidden)void load()}
    document.addEventListener('visibilitychange',visible)
    return()=>{active=false;controller.abort();clearInterval(timer)
      document.removeEventListener('visibilitychange',visible)}
  },[refresh])
  // Licensed multi-region AIS connector. An unavailable or unconfigured
  // provider must never be presented as zero shipping traffic.
  useEffect(()=>{
    let active=true
    const controller=new AbortController()
    const load=async()=>{
      if(!active||document.hidden||pausedRef.current)return
      try{
        const response=await fetch('/api/watchtower/open-waters',{
          cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(28000)]),
        })
        if(!response.ok)throw Error('Open Waters HTTP '+response.status)
        const data=await response.json() as OpenWatersSnapshot
        if(data.source!=='Open Waters AIS'||!Array.isArray(data.assets)||
          !Array.isArray(data.areas))throw Error('Invalid Open Waters AIS response')
        if(active){setOpenWaters(data);setOpenWatersError('')}
      }catch(error){
        if(active&&!controller.signal.aborted)
          setOpenWatersError(error instanceof Error?error.message:'Open Waters AIS unavailable')
      }
    }
    void load()
    const timer=setInterval(()=>void load(),180000)
    const visible=()=>{if(!document.hidden)void load()}
    document.addEventListener('visibilitychange',visible)
    return()=>{active=false;controller.abort();clearInterval(timer)
      document.removeEventListener('visibilitychange',visible)}
  },[refresh])
  // Public data-tracking.net AIS chokepoints refresh separately from aircraft,
  // advisories and licensed VesselFinder. Do not fake unsupported coverage.
  useEffect(()=>{
    let active=true
    const controller=new AbortController()
    const load=async()=>{
      if(!active||document.hidden||pausedRef.current)return
      try{
        const response=await fetch('/api/watchtower/chokepoints',{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(27000)]),
        })
        if(!response.ok){
          console.warn('[Watchtower][AIS] data-tracking.net HTTP',response.status)
          throw Error('Chokepoint AIS feed HTTP '+response.status)
        }
        const body=await response.json() as DataTrackingSnapshot
        if(!Array.isArray(body.assets)||!Array.isArray(body.chokepoints)||
          body.source!=='hormuz.data-tracking.net')throw Error('Invalid chokepoint AIS response')
        console.info('[Watchtower][AIS] data-tracking.net status',{
          fetchedAt:new Date().toISOString(),cargoMarkers:body.assets.length,
          chokepoints:body.chokepoints.map(area=>({
            name:area.label,status:area.state,rawRows:area.providerRows??null,
            cargoWithCoordinates:area.usableCargoRows??null,
             allVesselsWithCoordinates:area.usablePositionRows??null,
             moving:area.movingCount??null,
            mappedShips:area.vesselCount,crossings24h:area.crossings24h,
            lastPoll:area.lastPoll,
          })),
        })
        if(body.assets.length===0)console.warn('[Watchtower][AIS] No usable cargo fixes; crossing totals are not coordinates.')
        if(active){setMaritimeFeed(body);setMaritimeError('')}
      }catch(reason){
        if(active&&!controller.signal.aborted){
          console.error('[Watchtower][AIS] Request or parsing failed',
            reason instanceof Error?reason.message:'Unknown error')
          setMaritimeError('data-tracking.net AIS temporarily unavailable; last received snapshots may be stale.')
        }
      }
    }
    void load()
    const timer=setInterval(()=>{void load()},25*60000)
    const visible=()=>{if(!document.hidden)void load()}
    document.addEventListener('visibilitychange',visible)
    return()=>{active=false;controller.abort();clearInterval(timer)
      document.removeEventListener('visibilitychange',visible)}
  },[refresh])
  // Opt-in GCC web radar, 5-minute polling. Server handles permission gates.
  // Browser polls every 5 minutes while visible, without a background daemon.
  useEffect(()=>{
    let running=false,active=true
    const controller=new AbortController()
    const load=async()=>{
      if(running||!active||document.hidden||pausedRef.current)return
      running=true
      try{
        const response=await fetch('/api/watchtower/gcc-radar',{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(52000)]),
        })
        if(!response.ok){
          let detail='No server detail'
          try{
            const result=await response.json() as {error?:unknown}
            if(typeof result.error==='string')detail=result.error.slice(0,200)
          }catch{ /* Invalid error body */ }
          console.warn('[Watchtower][GCC] HTTP',response.status,detail)
          throw Error('GCC radar HTTP '+response.status+': '+detail)
        }
        const body=await response.json() as GccRadarSnapshot
        if(!Array.isArray(body.assets)||!Array.isArray(body.hubs)||
           body.source!=='MyShipTracking API'&&body.source!=='MyShipTracking public pages')throw Error('Invalid GCC radar result')
        console.groupCollapsed('[Watchtower][GCC] MyShipTracking scan',body.status,new Date().toISOString())
        console.info('Source:',body.source,'| Enabled:',body.configured,
          '| Vessel pages checked:',body.checked,'| Vessel markers:',body.assets.length,
          '| Cargo class:',body.assets.filter(a=>a.cargo==='ais_cargo_class').length,
          '| Estimated routes:',body.withRoutes)
        console.table(body.hubs.map(hub=>({
          port:hub.label,status:hub.status,discovered:hub.candidates,
          checked:hub.inspected??null,mapped:hub.observed,
          cargoClass:hub.cargoClass??null,missingGPS:hub.incomplete??null,
          blocked:hub.blocked??null,routes:hub.withRoutes,detail:hub.detail,
        })))
        console.info('Source diagnostic:',body.sourceNote)
        console.groupEnd()
        if(body.status==='not_configured')console.warn('[Watchtower][GCC] Radar not configured on server.')
        else if(body.assets.length===0)console.warn('[Watchtower][GCC] No usable ship positions in provider response; see per-port diagnostics.')
        if(active){setGccRadar(body);setGccRadarError('')}
      }catch(reason){
        if(active&&!controller.signal.aborted){
          console.error('[Watchtower][GCC] Request or parsing failed',
            reason instanceof Error?reason.message:'Unknown error')
          setGccRadarError('GCC radar unavailable; existing AIS observations remain visible.')
        }
      }finally{running=false}
    }
    void load()
    const timer=setInterval(()=>void load(),300000)
    const visible=()=>{if(!document.hidden)void load()}
    document.addEventListener('visibilitychange',visible)
    return()=>{active=false;controller.abort();clearInterval(timer)
      document.removeEventListener('visibilitychange',visible)}
  },[refresh])
  useEffect(() => {
    setPosture(null); setFoodError('')
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
  const allAssets=useMemo(()=>{
    const incoming=[
      ...(openSea?.assets??[]),...(globalAis?.assets??[]),...(openWaters?.assets??[]),...(snapshot?.assets??[]),
      ...regionalAir.flatMap(batch=>batch.assets),
      ...(maritimeFeed?.assets??[]),...(gccRadar?.assets??[]),
    ]
    // Regional AIS can contain >1,500 actual ship positions. Do not impose
    // the port-page scanner's 48-vessel ceiling on the combined map.
    const allVessels=mergeAssets(incoming.filter(asset=>asset.kind==='vessel'))
      .sort((a,b)=>Number((b.speedKnots??0)>=1.5)-Number((a.speedKnots??0)>=1.5)||
        b.observedAt.localeCompare(a.observedAt))
    // Reserve capacity for actual AIS reports outside Hormuz, so a huge Gulf
    // snapshot does not displace the Red Sea/Gulf of Aden or global coverage.
    const outsideGulf=allVessels.filter(a=>!(a.lat>=22&&a.lat<=31&&a.lon>=47&&a.lon<=61))
    const gulf=allVessels.filter(a=>a.lat>=22&&a.lat<=31&&a.lon>=47&&a.lon<=61)
    const vessels=[...outsideGulf.slice(0,1100),...gulf.slice(0,800)]
    const aircraftCandidates=mergeAssets(incoming.filter(asset=>asset.kind==='aircraft'))
    const aircraft=[
      ...aircraftCandidates.filter(a=>a.lat>=7&&a.lat<=42&&a.lon>=25&&a.lon<=80).slice(0,2600),
      ...aircraftCandidates.filter(a=>a.lat<7||a.lat>42||a.lon<25||a.lon>80).slice(0,450),
    ]
    return [...aircraft,...vessels]
  },[openSea,globalAis,openWaters,snapshot,maritimeFeed,gccRadar,regionalAir])
  const assets = useMemo(() => allAssets.filter(a =>
    inside(a) &&
    (a.kind==='vessel'
      ? visibleUnderwayVessel(a,now)&&
        (shipView!=='cargoMoving'||a.cargo==='ais_cargo_class')
      : (!freightFlightsOnly||a.cargo==='operator_inferred')) &&
    (!query || (a.label+' '+a.id+' '+(a.destination??'')).toLowerCase().includes(query.toLowerCase())),
  ),[allAssets,inside,shipView,freightFlightsOnly,query,now])
  // Risk overlays are worldwide, independent from the transport/asset
  // region filter. Leaflet clips display to the current map viewport.
  const alerts=useMemo(()=>allAlerts.filter(a=>
    !query||(a.title+' '+a.source).toLowerCase().includes(query.toLowerCase()),
  ),[allAlerts,query])
  // Organization-level indicators do not become global food-crisis alerts.
  const riskZones=useMemo<ProductionRiskZone[]>(()=>(
    productionRisk?.zones??[]).filter(zone=>
    !query||(zone.name+' '+zone.country+' '+zone.driver+' '+zone.eventTitles.join(' ')).toLowerCase().includes(query.toLowerCase())),
  ),[productionRisk,query])
  const externalRiskAlerts = useMemo(
    () => allAlerts.filter(alert=>alert.source!=='Organization food ledger'&&
      (!query||(alert.title+' '+alert.source).toLowerCase().includes(query.toLowerCase()))),
    [allAlerts,query],
  )
  const selectedIpc=ipcRisk?.risks.find(r=>r.id===selectedIpcId)
  const displayedIpc=useMemo(()=>(ipcRisk?.risks??[]).filter(r=>
    !query||(r.country+' '+r.period).toLowerCase().includes(query.toLowerCase())),
    [ipcRisk,query])
  const displayedRiskAlerts=useMemo(()=>externalRiskAlerts.filter(alert=>
    riskPanelFilter==='all'||(riskPanelFilter==='hazards'&&alert.kind==='hazard')||
    (riskPanelFilter==='logistics'&&['aviation','maritime'].includes(alert.kind))),
    [externalRiskAlerts,riskPanelFilter])

  const selectedAsset = allAssets.find(a => a.id === selectedId), selectedAlert = allAlerts.find(a => a.id === selectedId)
  const selectedProductionZone=(productionRisk?.zones??[]).find(zone=>zone.id===selectedId)
  // Load a bounded selection of real 7-day AIS tracks separately from ship
  // positions. A failed trace request must never hide a vessel icon.
  useEffect(()=>{
    if(!maritimeFeed?.assets.length)return
    const controller=new AbortController()
    const load=async()=>{
      try{
        const response=await fetch('/api/watchtower/chokepoint-tracks',{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(26000)]),
        })
        if(!response.ok)throw Error('AIS history unavailable')
        const data=await response.json() as HistoryOverlay
        if(!Array.isArray(data.routes))throw Error('AIS history schema invalid')
        if(!controller.signal.aborted){
          setAISHistory(previous=>{
            const byId=new globalThis.Map(previous.map(route=>[route.id,route]))
            for(const route of data.routes)if(route.status==='observed')byId.set(route.id,route)
            return [...byId.values()].slice(-80)
          })
          setAISHistoryStatus(data.observed+' observed tracks / '+data.checked+' ships checked')
        }
      }catch{
        if(!controller.signal.aborted)
          setAISHistoryStatus('AIS track history unavailable; positions can still be shown.')
      }
    }
    void load()
    return()=>controller.abort()
  },[maritimeFeed?.generatedAt])
  useEffect(()=>{
    const asset=allAssets.find(a=>a.id===selectedId)
    if(!asset||asset.kind!=='vessel'||!asset.chokepointId)return
    // Keep a narrowed primitive across the async closure for strict TS checks.
    const chokepoint:ChokepointId=asset.chokepointId
    const controller=new AbortController()
    const load=async()=>{
      try{
        const response=await fetch('/api/watchtower/chokepoint-tracks?'+
          new URLSearchParams({mmsi:asset.id.slice(4),chokepoint}),{
          cache:'no-store',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(9000)]),
        })
        if(!response.ok)return
        const route=await response.json() as AISRoute
        if(!controller.signal.aborted&&route.status==='observed')
          setAISHistory(previous=>[...previous.filter(r=>r.id!==route.id),route].slice(-80))
      }catch{ /* selected ship remains visible even if its trace fails */ }
    }
    void load()
    return()=>controller.abort()
  },[selectedId,allAssets])

  const selectedSource=snapshot?.sources.find(s=>s.id===sourceId)
  const chooseChokepoint=(id:ChokepointId)=>{
    const point=TRACKED_CHOKEPOINTS.find(item=>item.id===id)
    if(!point)return
    setRegion('gulf')
    setFocus({lat:point.lat,lon:point.lon,zoom:6,token:Date.now()})
    if(mobile){setFiltersOpen(false);setAlertsOpen(false)}
  }
  const recentCount = allAssets.filter(a => freshAsset(a, now)).length
  const staleSnapshot = Boolean(snapshot && now - Date.parse(snapshot.generatedAt) > 180000)
  const airSource = snapshot?.sources.find(s => s.id === 'adsb'), seaSource = snapshot?.sources.find(s => s.id === 'ais')
  const known = (state: string | undefined) => state === 'partial' || state === 'available' || state === 'stale'
  const riskReadable = Boolean(snapshot?.sources.some(s => ['gdacs', 'easa', 'hormuz'].includes(s.id) && known(s.state)))
  const select = useCallback((id: string) => { setSelectedId(id); setSourceId(null); setAlertsOpen(true); if (mobile) setFiltersOpen(false) }, [mobile])
  const choose = (item: TrackingAsset | MapAlert) => {
    setSelectedIpcId(null)
    if(item.kind!=='aircraft'&&item.kind!=='vessel')setRegion('global')
    select(item.id);setFocus({lat:item.lat,lon:item.lon,zoom:5,token:Date.now()})
  }
  const setView = (key: Region) => { setRegion(key); setFocus({ ...REGIONS[key], token: Date.now() }) }
  const toggleFull = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.current?.requestFullscreen() }
    catch { setError('Fullscreen is unavailable in this browser. The map still fills the Watchtower workspace.') }
  }
  const nearby = selectedAsset ? allAlerts.filter(a => a.kind === 'hazard' && separationKm(a, selectedAsset) <= 350).slice(0, 3) : []
  const nearGateway = selectedAsset ? [...CHOKEPOINTS].sort((a, b) => separationKm(a, selectedAsset) - separationKm(b, selectedAsset))[0] : null
  return <div id="watchtower-map" ref={root} className={styles.shell} dir={ar ? 'rtl' : 'ltr'}>
    <Map assets={assets} historyAssets={allAssets} alerts={alerts} riskZones={riskZones} chokepoints={maritimeFeed?.chokepoints??[]} aisRoutes={aisHistory} layers={layers} selectedId={selectedId} onSelect={select} onChokepointClick={chooseChokepoint} focus={focus} now={now} />
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
        { label: 'Aircraft observations', value: (known(airSource?.state)||regionalAir.some(b=>b.succeeded>0)) ? assets.filter(a => a.kind === 'aircraft').length : null, note: freightFlightsOnly?'Freight-operator candidates only':'Regional ADS-B, all observed classes', icon: Plane },
        { label: 'Vessel observations', value: (openWaters?.state==='available'||openWaters?.state==='partial'||globalAis?.state==='partial'||globalAis?.state==='stale'||openSea?.state==='available'||openSea?.state==='stale'||known(seaSource?.state)||Boolean(maritimeFeed?.chokepoints.some(point=>point.state==='partial'||point.state==='stale'))||Boolean(gccRadar?.configured)) ? assets.filter(a => a.kind === 'vessel').length : null, note: (openWaters?.state==='available'||openWaters?.state==='partial')?'Multi-region Open Waters AIS':globalAis?.state==='partial'?'OpenSeaFeed global AIS + regional sources':openSea?.state==='available'?'hormuz.now regional AIS + other sources':openSea?.state==='stale'?'Regional AIS delayed':maritimeFeed?'data-tracking.net AIS + port samples':'Awaiting regional AIS coverage', icon: Ship },
        { label: 'Worldwide risk reports', value: riskReadable ? externalRiskAlerts.length : null, note: 'Worldwide reports, not viewport-limited', icon: AlertTriangle },
        { label: 'IPC assessed countries', value: ipcRisk?.state==='available'?ipcRisk.countryCount:null, note: ipcRisk?.state==='unavailable'?'IPC source unavailable':ipcRisk?.state==='partial'?'IPC data incomplete':'IPC Phase 3+ population assessments', icon: Wheat },
      ].map(item => <div key={item.label} className={styles.stat}><label>{item.label}</label><strong>{count(item.value)}</strong><item.icon size={21} /><small>{item.note}</small></div>)}</div>
    </header>
    {error && <div className={styles.statusError} role="alert">{error}</div>}
    <aside className={`${styles.panel} ${styles.filters} ${filtersOpen ? '' : styles.hidePanel}`} aria-label="Map controls">
      <div className={styles.panelTitle}>
        <span>MAP CONTROLS</span>
        <button className={styles.iconButton} aria-label="Close map controls" onClick={()=>setFiltersOpen(false)}><X size={12}/></button>
      </div>
      <label className={styles.label} htmlFor="watchtower-search"><Search size={11} className="inline"/> Search</label>
      <input id="watchtower-search" className={styles.input} value={query} maxLength={100}
        placeholder="Vessel, aircraft, destination..." onChange={e=>setQuery(e.target.value)}/>
      {query&&<div className={styles.searchMatches}>{assets.slice(0,5).map(asset=>
        <button key={asset.id} onClick={()=>choose(asset)}>
          {asset.kind==='aircraft'?'AIR':'SEA'} / {asset.label}
        </button>)}</div>}
      <label className={styles.label} htmlFor="watchtower-region">Map area</label>
      <select id="watchtower-region" className={styles.input}
        value={region} onChange={e=>setView(e.target.value as Region)}>
        {Object.entries(REGIONS).map(([key,value])=><option key={key} value={key}>{value.name}</option>)}
      </select>
      <label className={styles.label} htmlFor="watchtower-ship-mode">Vessels</label>
      <select id="watchtower-ship-mode" className={styles.input} value={shipView}
        onChange={e=>setShipView(e.target.value as ShipView)}>
        <option value="moving">Ships underway (SOG ≥1.5 kn)</option>
        <option value="cargoMoving">Cargo-class ships underway</option>
      </select>
      <p className={styles.controlSummary}>
        <strong>{assets.filter(a=>a.kind==='vessel').length.toLocaleString('en-US')}</strong> vessels shown
        <span> · {assets.filter(a=>a.kind==='vessel'&&a.speedKnots!==null&&a.speedKnots>=1.5).length} with SOG ≥1.5 kn</span>
      </p>
      <div className={styles.controlSectionHeading}>Show on map</div>
      {([
        ['vessels',Ship,'Vessels'],
        ['aircraft',Plane,'Aircraft (all classes)'],
      ] as const).map(([key,Icon,title])=>
        <button key={key} className={styles.toggle} aria-pressed={layers[key]}
          onClick={()=>setLayers(current=>({...current,[key]:!current[key]}))}>
          <span><Icon size={13}/>{title}</span><i className={styles.switch}/>
        </button>)}
      <button className={styles.toggle} aria-pressed={freightFlightsOnly}
        onClick={()=>setFreightFlightsOnly(value=>!value)}>
        <span><Plane size={13}/>Only freight-operator candidates</span><i className={styles.switch}/>
      </button>
      <button className={styles.toggle} aria-pressed={layers.risks||layers.production}
        onClick={()=>setLayers(current=>({...current,
          risks:!(current.risks||current.production),
          production:!(current.risks||current.production),
        }))}>
        <span><AlertTriangle size={13}/>Risk areas & alerts</span><i className={styles.switch}/>
      </button>
      <button className={styles.toggle} aria-pressed={layers.trails||layers.projections}
        onClick={()=>setLayers(current=>({...current,
          trails:!(current.trails||current.projections),
          projections:!(current.trails||current.projections),
        }))}>
        <span><Layers size={13}/>Available routes & tracks</span><i className={styles.switch}/>
      </button>
      <p className={styles.controlNote}>Stationary and port-berthed vessels, unknown-speed ships, webpage captures and positions older than two hours are hidden. Reported SOG is not proof of a voyage.</p>
      <details className={styles.sourcesDetails}>
        <summary>Data sources & freshness</summary>
        <div className={styles.sourceBody}>
          <p><strong>Regional AIS:</strong> {openSea?.state??'loading'}
            {openSea?' · '+openSea.acceptedCount+' mapped / '+(openSea.providerCount??'N/A')+' provider rows':''}.
            {openSea?.providerAt?' Source '+utc(openSea.providerAt)+'.':''}
          </p>
          {openSeaError&&<p>{openSeaError}</p>}
          <p><strong>Regional ADS-B grid:</strong> {regionalAir.length}/{REGIONAL_AIR_BATCH_COUNT} batches received,
            {' '}{regionalAir.reduce((n,b)=>n+b.succeeded,0)}/60 search circles responding,
            {' '}{regionalAir.reduce((n,b)=>n+b.failed,0)} source errors,
            {' '}{regionalAirFailedBatches.length} batch requests failed.
            {' '}{regionalAirLoading?'Loading remaining areas.':''}
          </p>
          <p><strong>ADS-B errors:</strong> {Object.entries(regionalAir.reduce<Record<string,number>>(
            (errors,batch)=>{
              for(const [code,n] of Object.entries(batch.failureCodes??{}))
                errors[code]=(errors[code]??0)+n
              return errors
            },{})).map(([code,n])=>code+': '+n).join(' · ')||'none reported'}.
            A failed request does not mean empty airspace.
          </p>
          <p><strong>OpenSeaFeed:</strong> {globalAis?.state??'loading'} · {globalAis?.accepted??'N/A'} mapped,
            {globalAis?.regional??'N/A'} regional. {globalAisError}
          </p>
          <p><strong>Red Sea / Arabian Sea / Indian Ocean AIS:</strong> {openWaters?.state??'loading'}.
            {' '}{openWaters?.vessels??'N/A'} source-observed vessels across
            {' '}{openWaters?.areas.filter(a=>a.state==='available').length??0}/15 regions.
            {' '}{openWaters?.detail??''} {openWatersError}
          </p>
          {openWaters?.areas.filter(a=>a.state==='unavailable').map(a=><p key={a.id}>
            {a.name}: {a.reason??'no usable provider response'}</p>)}
          {openWaters?.attribution.map((credit,i)=><p key={i}>AIS attribution: {credit}</p>)}
          <p><strong>Global IPC food security:</strong> {ipcRisk?.state??'loading'} · {ipcRisk?.countryCount??'N/A'} assessed countries. {ipcRisk?.detail??''} {ipcError}</p>
          <p><strong>Chokepoint AIS:</strong> {maritimeFeed?.assets.length??'N/A'} positions,
            {maritimeFeed?.chokepoints.filter(c=>c.state==='partial').length??0} reporting areas.
            {maritimeError?' '+maritimeError:''}
          </p>
          <p><strong>Port-page sample:</strong> {gccRadar?.assets.length??'N/A'} positions,
            {gccRadar?.moving??'N/A'} reporting SOG ≥1.5 kn.
            {gccRadarError?' '+gccRadarError:''}
          </p>
          <p>Regional AIS is limited to actual provider reception:
            <a href="https://hormuz.now/data" target="_blank" rel="noopener noreferrer"> hormuz.now</a>,
            <a href="https://hormuz.data-tracking.net/api-docs" target="_blank" rel="noopener noreferrer"> data-tracking.net</a>
            {' '}and <a href="https://openseafeed.com/" target="_blank" rel="noopener noreferrer">OpenSeaFeed</a>.
            {' '}An optional <a href="https://openwaters.io/ais/" target="_blank" rel="noopener noreferrer">Open Waters AIS</a> adapter covers additional geographic zones when commercially authorised.
            Missing marine observations outside the Gulf do not imply no ship traffic.
            Port pages remain a sample capped at 48.
          </p>
          {aisHistoryStatus&&<p>{aisHistoryStatus}</p>}
        </div>
      </details>
    </aside>
    <div className={styles.feedDock} aria-label="Tracking source status">
      {snapshot?.sources.map(source => <button key={source.id} className={styles.feedPill} data-state={source.state} onClick={() => { setSourceId(source.id); setSelectedId(null); setAlertsOpen(true); if (mobile) setFiltersOpen(false) }}><i />{source.name}: {source.state}</button>)}
      {openSea&&<span className={styles.feedPill} data-state={openSea.state}><i/>Regional AIS: {openSea.state} · {openSea.acceptedCount.toLocaleString('en-US')}</span>}
      {globalAis&&<span className={styles.feedPill} data-state={globalAis.state}><i/>Global AIS: {globalAis.state} · {globalAis.accepted.toLocaleString('en-US')}</span>}
      {openWaters&&<span className={styles.feedPill} data-state={openWaters.state}><i/>Offshore AIS: {openWaters.state} · {openWaters.vessels}</span>}
      <span className={styles.feedPill} data-state={regionalAir.some(b=>b.succeeded>0)?'partial':'unavailable'}>
        <i/>ADS-B area: {regionalAir.reduce((n,b)=>n+b.succeeded,0)}/60 circles</span>
      {maritimeFeed&&<span className={styles.feedPill} data-state={maritimeFeed.assets.length?'partial':'unavailable'}>
        <i/>Chokepoint AIS: {maritimeFeed.assets.length}</span>}
    </div>
    <aside className={`${styles.panel} ${styles.alertPanel} ${alertsOpen ? '' : styles.hidePanel}`} aria-label="Alerts and selected observation">
      <div className={styles.panelTitle}><span>{selectedSource ? 'SOURCE STATUS' : selectedProductionZone ? 'PRODUCTION RISK EXPOSURE' : selectedIpc ? 'IPC FOOD INSECURITY' : selectedId ? 'OBSERVATION DETAILS' : 'GLOBAL FOOD SECURITY & RISK'}</span><button className={styles.iconButton} aria-label={selectedId || sourceId ? 'Back to alerts' : 'Close alert panel'} onClick={() => { if (selectedId || sourceId || selectedIpcId) { setSelectedId(null); setSourceId(null); setSelectedIpcId(null) } else setAlertsOpen(false) }}>{selectedId || sourceId || selectedIpcId ? <ChevronLeft size={12} /> : <X size={12} />}</button></div>
      <div className={styles.scroll}>
        {selectedSource ? <div className={styles.details}><Radio size={24} /><h2>{selectedSource.name}</h2><span className={styles.severity}>{selectedSource.state}</span><p className="mt-3">{selectedSource.detail}</p><div className={styles.detailGrid}><div><span>Last checked</span><strong>{utc(selectedSource.checkedAt)}</strong></div><div><span>Latest observation</span><strong>{utc(selectedSource.latestObservationAt)}</strong></div></div><a href={selectedSource.url} target="_blank" rel="noopener noreferrer">Provider documentation <ExternalLink size={11} className="inline" /></a><p className={styles.notice}>Unavailable coverage means unknown traffic or risk, not zero. Refreshing the screen does not make an old observation live.</p></div>
        : selectedIpc ? <div className={styles.details}>
          <Wheat size={24}/><h2>{selectedIpc.country}</h2>
          <p><strong>Acute food insecurity · IPC Phase 3+</strong></p>
          <div className={styles.detailGrid}>
            <div><span>Population in Phase 3+</span><strong>{selectedIpc.phase3Plus.toLocaleString('en-US')}</strong></div>
            <div><span>Assessed period</span><strong>{selectedIpc.from} to {selectedIpc.to}</strong></div>
            <div><span>Classification period</span><strong>{selectedIpc.period}</strong></div>
            <div><span>Phase 4 population</span><strong>{selectedIpc.phase4?.toLocaleString('en-US')??'Not reported'}</strong></div>
            <div><span>Phase 5 population</span><strong>{selectedIpc.phase5?.toLocaleString('en-US')??'Not reported'}</strong></div>
          </div>
          <p className={styles.notice}>National assessment, not an exact incident point. Coverage is limited to assessed countries and valid publication periods; figures are not live movement data.</p>
          <a href={selectedIpc.sourceUrl} target="_blank" rel="noopener noreferrer">Open official IPC dashboard <ExternalLink size={11} className="inline"/></a>
        </div>
        : selectedProductionZone ? <div className={styles.details}>
          <div className={styles.riskZoneHeading}>
            <span className={styles.severity} data-level={selectedProductionZone.severity==='high'?'high':'attention'}>
              {selectedProductionZone.severity==='high'?'HIGH EXPOSURE':'ELEVATED EXPOSURE'}
            </span>
            <h2>{selectedProductionZone.name}</h2>
            <p>{selectedProductionZone.country??'Regional location unresolved'} ·
              {' '}{selectedProductionZone.driver.toUpperCase()}</p>
          </div>
          <div className={styles.detailGrid}>
            <div><span>Last event report</span><strong>{utc(selectedProductionZone.observedAt)}</strong></div>
            <div><span>Source evidence</span><strong>{selectedProductionZone.evidenceCount} GDACS report(s)</strong></div>
            <div><span>Area basis</span><strong>{selectedProductionZone.boundaryBasis==='esri_admin1_screening'?
              'Administrative region':'Approximate point radius'}</strong></div>
            <div><span>Price increase measured</span><strong>Not available</strong></div>
          </div>
          <h3 className={styles.riskSubtitle}>Possible production exposure</h3>
          <p>{selectedProductionZone.productionExposure}</p>
          <h3 className={styles.riskSubtitle}>Potential cost transmission</h3>
          <p>{selectedProductionZone.costChannels}</p>
          <p className={styles.notice}>{selectedProductionZone.scopeNote} Crop production volume,
            affected cultivated hectares and price impact have not been verified.
            This is a screening warning, not a loss estimate or financial forecast.</p>
          <a target="_blank" rel="noopener noreferrer" href={selectedProductionZone.sourceUrl}>
            View GDACS event report <ExternalLink size={12} className="inline"/>
          </a>
          <p className={styles.hint}>Only events identified by the current sources are mapped.
            A missing polygon is not proof that agricultural production is safe.</p>
        </div>
        : selectedAsset ? <div className={styles.details}>
          {selectedAsset.kind === 'aircraft' ? <Plane size={25} /> : <Ship size={25} />}<h2>{selectedAsset.label}</h2>
          <span className={styles.severity}>{freshAsset(selectedAsset, now) ? 'RECENT OBSERVATION' : 'STALE POSITION'}</span>
          <div className={styles.detailGrid}>{[
            ['Identifier', selectedAsset.id.startsWith('sea:hn:')?'hormuz.now #'+selectedAsset.id.slice(7):selectedAsset.id.split(':')[1]], ['Last observed', age(selectedAsset.observedAt, now)], ['Type', selectedAsset.type || 'Unknown'],
            ['Speed', selectedAsset.speedKnots === null ? 'Unknown' : selectedAsset.speedKnots.toFixed(1) + ' kn'],
            ['Heading', selectedAsset.heading === null ? 'Unknown' : selectedAsset.heading.toFixed(0) + ' deg'],
            [selectedAsset.kind === 'aircraft' ? 'Altitude' : 'AIS destination', selectedAsset.kind === 'aircraft' ? (selectedAsset.altitudeFt === null ? 'Unknown' : selectedAsset.altitudeFt.toLocaleString() + ' ft') : selectedAsset.destination ?? 'Not reported'],
          ].map(([title, value]) => <div key={title}><span>{title}</span><strong>{value}</strong></div>)}</div>
          <p>{selectedAsset.lat.toFixed(4)}, {selectedAsset.lon.toFixed(4)} / {utc(selectedAsset.observedAt)}</p>
          <div className={styles.routeDetail}>
            <h3>Origin → Destination</h3>
            {selectedAsset.itinerary ? <>
              <div className={styles.detailGrid}>
                <div><span>Departure / last reported port</span>
                  <strong>{selectedAsset.itinerary.origin?.name??'Unavailable'}</strong>
                  <small>{selectedAsset.itinerary.origin?.code??'No verified code'}</small>
                </div>
                <div><span>Reported destination</span>
                  <strong>{selectedAsset.itinerary.destination?.name??'Unavailable'}</strong>
                  <small>{selectedAsset.itinerary.destination?.code??'No verified code'}</small>
                </div>
                <div><span>Departure time</span><strong>{utc(selectedAsset.itinerary.departureAt)}</strong></div>
                <div><span>Estimated arrival</span><strong>{utc(selectedAsset.itinerary.etaAt)}</strong></div>
              </div>
              <p className={styles.notice}>
                {selectedAsset.itinerary.confidence === 'lookup_plausible'?'Plausible callsign route lookup':
                  selectedAsset.itinerary.confidence === 'lookup_unverified'?'Unverified callsign lookup':'Crew-reported AIS / last-port data'}.
                {' '}{selectedAsset.itinerary.description}
              </p>
              <p>Map: dotted green = origin to latest position <strong>(reference, not proven travel)</strong>;
                dashed amber = latest position to destination <strong>(reference, not confirmed planned routing)</strong>.
                Solid green appears only for actual observed fixes.
                {selectedAsset.kind==='vessel'&&!selectedAsset.itinerary.modelSeaLegs?
                  ' A navigable maritime line is unavailable without resolved ports and an ocean-network geometry.':''}
              </p>
              <a href={selectedAsset.itinerary.sourceUrl} target="_blank" rel="noopener noreferrer">
                Itinerary source <ExternalLink size={11} className="inline"/>
              </a>
            </> : <p>Origin and destination are not returned by the connected tracking sources
              for this vehicle. The aircraft callsign / vessel identifier alone does not establish a journey.</p>}
          </div>
          <div className={styles.routeDetail}>
            <h3>Observed track</h3>
            <p>The solid green line contains only real position updates collected while this page has been open. Origin-to-position and position-to-destination routes are shown as labelled references when provider data is available. No short heading guides or artificial forward projections are drawn.</p>
          </div>
          {selectedAsset.hubId&&<div className={styles.routeDetail}>
            <h3>GCC port radar · MyShipTracking</h3>
            <p>{MONITORED_MARITIME_PORTS.find(h=>h.id===selectedAsset.hubId)?.label}</p>
            <p>{selectedAsset.observationBasis==='webpage_capture'?
              'Public webpage coordinates. AIS position time NOT provided; displayed observation may be old. Page inspected ':
              'Source-reported AIS position at '}
              {utc(selectedAsset.observedAt)}. Port names are source-reported; maritime reference lines are modeled, not verified sailed routes.</p>
          </div>}
          {selectedAsset.chokepointId&&<div className={styles.routeDetail}>
            <h3>Maritime chokepoint observation</h3>
            <p>{TRACKED_CHOKEPOINTS.find(point=>point.id===selectedAsset.chokepointId)?.label}</p>
            <p><strong>{selectedAsset.observationBasis==='position_report'?
              'Ship-specific AIS position timestamp':'Source snapshot timestamp only'}</strong></p>
            <p>Reported {utc(selectedAsset.observedAt)} · {age(selectedAsset.observedAt,now)}.</p>
            <p>History: {aisHistory.find(route=>route.id===selectedAsset.id)?.points??'Not loaded'}
              {' '}real AIS fixes mapped over the last 7 days. Missing tracks are not invented.</p>
            <p>Provider: data-tracking.net, CC BY 4.0. AIS positions may be delayed,
              missing or distorted. Transit and destination are not confirmed cargo shipments.</p>
            <a href={TRACKED_CHOKEPOINTS.find(point=>point.id===selectedAsset.chokepointId)?.pageUrl??'https://hormuz.data-tracking.net/'}
              target="_blank" rel="noopener noreferrer">Open source tracking <ExternalLink size={11} className="inline" /></a>
          </div>}
          <p className={styles.notice}>{selectedAsset.cargo === 'ais_cargo_class' ? 'AIS class identifies a cargo vessel.' : selectedAsset.cargo === 'operator_inferred' ? 'Freight-operator callsign heuristic, not a verified cargo manifest.' : selectedAsset.kind==='vessel' ? 'Vessel classification unverified or not a cargo class.' : 'Aircraft type alone does not confirm a cargo flight.'} Food cargo, supplier and purchase-order linkage are unverified.</p>
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
          <p className={styles.hint}>Worldwide assessments and source-backed events. The list is global even when the map is centred on Qatar. IPC indicates assessed acute food insecurity; GDACS indicates possible agricultural impacts; logistics advisories do not confirm shipment disruption.</p>
          <div className={styles.riskFilterRow}>
            {([
              ['all','All global risks'],['ipc','IPC food crises'],
              ['hazards','Production hazards'],['logistics','Logistics'],
            ] as const).map(([value,label])=><button key={value}
              className={styles.riskFilterButton}
              aria-pressed={riskPanelFilter===value}
              onClick={()=>setRiskPanelFilter(value)}>{label}</button>)}
          </div>
          {ipcRisk?.state==='unavailable'&&<p className={styles.notice}>IPC feed unavailable. {ipcRisk.detail}</p>}
          {ipcError&&<p className={styles.notice}>IPC: {ipcError}</p>}
          {productionRisk?.status==='unavailable'&&<p className={styles.notice}>GDACS production screening unavailable. Global safety cannot be inferred.</p>}
          {(riskPanelFilter==='all'||riskPanelFilter==='ipc')&&displayedIpc.length>0&&
            <div className={styles.controlSectionHeading}>Acute food insecurity · IPC / CH</div>}
          {(riskPanelFilter==='all'||riskPanelFilter==='ipc')&&displayedIpc.map(r=>
            <button key={r.id} className={styles.alert} onClick={()=>{
              setSelectedId(null);setSourceId(null);setSelectedIpcId(r.id);setAlertsOpen(true)
            }}>
              <div className={styles.alertHead}>
                <span className={styles.severity} data-level="high">IPC Phase 3+</span>
                <small>{r.period}</small>
              </div>
              <strong>{r.country}</strong>
              <p>{r.phase3Plus.toLocaleString('en-US')} assessed people in IPC Phase 3+ · {r.from} to {r.to}</p>
            </button>)}
          {(staleSnapshot || paused) && <p className={styles.notice}>{paused ? 'Automatic updates paused. Positions will age.' : 'Tracking snapshot is stale. Source availability may have changed.'}</p>}
          <div className="mt-3">{(riskPanelFilter==='ipc'?[]:displayedRiskAlerts).map(alert => <button key={alert.id} className={styles.alert} onClick={() => choose(alert)}><div className={styles.alertHead}><span className={styles.severity} data-level={alert.severity}>{alert.severity}</span><small>{alert.source}</small></div><strong>{alert.title}</strong><p>{alert.kind === 'food' ? 'Organization-level signal' : alert.kind === 'aviation' ? 'Advisory / not a verified closure' : alert.kind === 'maritime' ? 'Regional report / position approximate' : 'Reported hazard / impact unverified'}</p></button>)}</div>
          {!displayedRiskAlerts.length && !displayedIpc.length && <p className={styles.empty}>{busy ? 'Loading source-backed observations...' : 'No matching mapped reports in this response. Missing feeds are not evidence that a corridor is safe.'}</p>}
        </>}
      </div>
    </aside>
    <div className={styles.legend}><span><Plane size={12} color="var(--growa-sage)" />Aircraft</span><span><Ship size={12} color="var(--growa-ink-600)" />AIS vessel</span><span><AlertTriangle size={12} color="var(--warning-strong)" />Reported risk</span><span><i className={styles.productionRiskSwatch} />Production risk areas ({layers.production?riskZones.length:0})</span><span><i className={styles.routePastLine} />Observed</span><span><i className={styles.routeOriginLine} />From origin (reference)</span><span><i className={styles.routeFutureLine} />To destination (reference)</span></div>
    <footer className={styles.footer}><span>{busy ? 'UPDATING SOURCES' : snapshot ? 'SNAPSHOT ' + utc(snapshot.generatedAt) : 'CONNECTING TO SOURCES'} / {paused ? 'PAUSED' : 'AUTO 60s'}</span><span>ESRI POLITICAL MAP · ADSB.lol / ODbL 1.0 · regional AIS CC BY 4.0 · OpenSeaFeed · No simulated traffic</span></footer>
  </div>
}
