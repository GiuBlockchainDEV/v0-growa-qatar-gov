import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {GCC_PUBLIC_PORTS,isPublicCargoType,parsePublicPortCandidates,
  parsePublicVessel,selectPublicGccCandidates,type PublicVesselCandidate} from './myshiptracking-public'
const stamp=new Date(Date.now()-30*60000)
const t=stamp.toISOString().slice(0,16).replace('T',' ')
const portHtml=`<html><table><tr><td>DEPARTURE</td><td>
<a href="/vessels/cargo-bulk-imo-1234567-mmsi-123456789">CARGO BULK</a></td></tr>
<tr><td>ARRIVAL</td><td><a href="/vessels/oil-tanker-imo-1234568-mmsi-223456789">
OIL TANKER</a></td></tr></table></html>`
const cargo=`<!doctype html><html><head><title>CARGO BULK - Bulk Carrier (IMO: 1234567, MMSI: 123456789) | MyShipTracking</title></head>
<body><h1>CARGO BULK</h1><div>Current Position: coordinates 25.12345° / 55.23456° as reported on ${t}
 Speed: 12.5 kn Course: 135° Info</div>
<script type="application/json">{"last_port":"Jebel Ali","destination":"QAHMD"}</script></body></html>`
describe('Public HTML GCC radar without MyShipTracking API',()=>{
 it('extracts bounded vessel candidates from public port tables',()=>{
  const candidates=parsePublicPortCandidates(portHtml,'AEJEA',12)
  expect(candidates).toHaveLength(2)
  expect(candidates[0].event).toBe('DEPARTURE')
  expect(candidates[0].url).toContain('/vessels/cargo-bulk-imo-1234567-mmsi-123456789')
  expect(parsePublicPortCandidates(portHtml,'AEJEA',1)).toHaveLength(1)
 })
 it('accepts only confidently classified cargo vessels',()=>{
  expect(isPublicCargoType('Bulk Carrier')).toBe(true)
  expect(isPublicCargoType('Container Ship')).toBe(true)
  expect(isPublicCargoType('Oil Tanker')).toBe(false)
  expect(isPublicCargoType('Unknown')).toBe(false)
 })
 it('uses real timestamped GPS, speed and reported ports; never fabricates actual sailed paths',()=>{
  const ref=parsePublicPortCandidates(portHtml,'AEJEA')[0]
  const result=parsePublicVessel(cargo,ref)!
  expect(result).toBeTruthy()
  expect(result.id).toBe('sea:123456789')
  expect(result.source).toBe('MyShipTracking public website')
  expect(result.speedKnots).toBe(12.5)
  expect(result.itinerary?.origin?.code).toBe('AEJEA')
  expect(result.itinerary?.destination?.code).toBe('QAHMD')
  expect(result.itinerary?.modelSeaLegs).toBeUndefined()
  expect(result.foodCargoVerified).toBe(false)
 })
 it('preserves stationary ships and rejects missing GPS or impossible coordinates',()=>{
  const ref=parsePublicPortCandidates(portHtml,'AEJEA')[0]
  expect(parsePublicVessel(cargo.replace(/as reported on [0-9:\- ]+/,'as reported on N/A'),ref)).toBeNull()
  expect(parsePublicVessel(cargo.replace('Speed: 12.5 kn','Speed: 0.2 kn'),ref)?.speedKnots).toBe(0.2)
  expect(parsePublicVessel(cargo.replace('Speed: 12.5 kn','No vessel speed'),ref)?.speedKnots).toBeNull()
  expect(parsePublicVessel(cargo.replace('25.12345°','99.12345°'),ref)).toBeNull()
 })
 it('finds ship links even when the port contains unrelated HTML tables',()=>{
  const html='<table><tr><td>Unrelated</td></tr></table>'+
    '<div class="vessels"><a href="/vessels/cargo-bulk-imo-1234567-mmsi-123456789">CARGO BULK</a></div>'
  expect(parsePublicPortCandidates(html,'QADOH')).toHaveLength(1)
 })
 it('does not discard ships because speed is listed after an Info heading',()=>{
  const ref=parsePublicPortCandidates(portHtml,'AEJEA')[0]
  const changed=cargo.replace('Speed: 12.5 kn Course: 135° Info','Info Speed: 12.5 kn Course: 135°')
  expect(parsePublicVessel(changed,ref)?.speedKnots).toBe(12.5)
 })
 it('logs diagnostic summaries in the browser console without dumping positions or credentials',()=>{
  const ui=readFileSync(join(process.cwd(),'components/dashboard/watchtower/global-watchtower.tsx'),'utf8')
  expect(ui).toContain("console.groupCollapsed('[Watchtower][GCC] MyShipTracking scan'")
  expect(ui).toContain('console.table(body.hubs.map')
  expect(ui).toContain("console.warn('[Watchtower][GCC] HTTP'")
  expect(ui).toContain("console.info('[Watchtower][AIS] data-tracking.net status'")
  expect(ui).not.toContain('console.log(orgId)')
  expect(ui).not.toContain('console.log(body.assets)')
 })
 it('accepts Python-style lat/lng JavaScript coordinates without fabricating an AIS timestamp',()=>{
  const ref=parsePublicPortCandidates(portHtml,'AEJEA')[0]
  const page=`<html><head><title>CARGO BULK - Cargo (IMO: 1234567, MMSI: 123456789)</title></head>
   <body><h1>CARGO BULK</h1><script>var lat=25.12345;var lng=55.23456;var speed=8.5;</script>
   <section>Public ship details; no ship-specific AIS observation date here</section></body></html>`
  const asset=parsePublicVessel(page,ref)
  expect(asset?.lat).toBeCloseTo(25.12345)
  expect(asset?.lon).toBeCloseTo(55.23456)
  expect(asset?.observationBasis).toBe('webpage_capture')
  expect(asset?.speedKnots).toBe(8.5)
  expect(asset?.foodCargoVerified).toBe(false)
 })
 it('scans 12 candidates per hub, not 4 or a global first-port slice',()=>{
  const candidates:PublicVesselCandidate[]=[
    ...(['AEJEA','QADOH','QARLF'] as const).flatMap(hubId=>
      Array.from({length:12},(_,i)=>({
        hubId,name:hubId+' '+i,
        url:'https://www.myshiptracking.com/vessels/'+hubId.toLowerCase()+'-'+i,
        event:'UNCONFIRMED' as const,
      })))
  ]
  const selected=selectPublicGccCandidates(candidates)
  expect(selected).toHaveLength(36)
  expect(selected.slice(0,3).map(a=>a.hubId)).toEqual(['AEJEA','QADOH','QARLF'])
  expect(selected.filter(a=>a.hubId==='AEJEA')).toHaveLength(12)
  expect(selected.filter(a=>a.hubId==='QADOH')).toHaveLength(12)
  expect(selected.filter(a=>a.hubId==='QARLF')).toHaveLength(12)
  expect(selectPublicGccCandidates(candidates,4)).toHaveLength(12)
 })
 it('retains port-service vessels without mislabelling them cargo or food shipments',()=>{
  const candidate:PublicVesselCandidate={
    hubId:'QARLF',name:'HALUL 71',
    url:'https://www.myshiptracking.com/vessels/halul-71-imo-9876543',
    event:'DEPARTURE',
  }
  const html=`<html><head><title>HALUL 71 - Offshore Supply Vessel (IMO: 9876543) | MyShipTracking</title></head>
   <body><h2>HALUL 71</h2><script>var lat=25.66777;var lng=52.41100;var speed=4.1;</script>
   <div>Previous port RAS LAFFAN; destination HALUL ISLAND</div></body></html>`
  const ship=parsePublicVessel(html,candidate)
  expect(ship?.id).toBe('sea:page:halul-71-imo-9876543')
  expect(ship?.label).toBe('HALUL 71')
  expect(ship?.lat).toBeCloseTo(25.66777)
  expect(ship?.lon).toBeCloseTo(52.411)
  expect(ship?.speedKnots).toBe(4.1)
  expect(ship?.cargo).toBe('unverified')
  expect(ship?.foodCargoVerified).toBe(false)
  expect(ship?.observationBasis).toBe('webpage_capture')
 })
 it('retains a ship with a readable MMSI even when not classified as cargo',()=>{
  const ref=parsePublicPortCandidates(portHtml,'AEJEA')[1]
  const html=cargo.replace('Bulk Carrier','Oil Tanker')
  const ship=parsePublicVessel(html,ref)
  expect(ship?.id).toBe('sea:223456789')
  expect(ship?.cargo).toBe('unverified')
  expect(ship?.lat).toBeCloseTo(25.12345)
 })
 it('defaults to moving vessels and keeps cargo-class filtering optional',()=>{
  const ui=readFileSync(join(process.cwd(),'components/dashboard/watchtower/global-watchtower.tsx'),'utf8')
  expect(ui).toContain("[shipView,setShipView]=useState<ShipView>('moving')")
  expect(ui).toContain('Cargo-class ships underway')
  expect(ui).toContain("a.cargo==='ais_cargo_class'")
 })
 it('has no hardcoded API dependency or automatic bot-evasion techniques',()=>{
  const source=readFileSync(join(process.cwd(),'lib/watchtower/myshiptracking-public.ts'),'utf8')
  const api=readFileSync(join(process.cwd(),'app/api/watchtower/gcc-radar/route.ts'),'utf8')
  const client=readFileSync(join(process.cwd(),'components/dashboard/watchtower/global-watchtower.tsx'),'utf8')
  expect(source).not.toContain('MYSHIPTRACKING_API_KEY')
  expect(source).not.toContain('navigator.webdriver')
  expect(source).not.toContain('AutomationControlled')
  expect(source).toContain('WATCHTOWER_MST_SCRAPE_ENABLED')
  expect(source).toContain('GCC_RADAR_INTERVAL_MS')
  expect(api).toContain('buildSessionContext({})')
  expect(api).toContain('canViewGlobalMaritimeRadar(session.payload)')
  expect(api).not.toContain('organizationId')
  expect(api).toContain('getPublicGccRadarSnapshot()')
  expect(client).toContain('setInterval(()=>void load(),300000)')
  expect(GCC_PUBLIC_PORTS.find(p=>p.id==='QARLF')?.url).toContain('id-5836')
 })
})
