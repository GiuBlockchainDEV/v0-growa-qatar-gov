import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {GCC_PUBLIC_PORTS,selectPublicGccCandidates,type PublicVesselCandidate}
  from './myshiptracking-public'
import {MONITORED_MARITIME_PORTS,REGIONAL_SCAN_PORTS,type GccHubId}
  from './myshiptracking-gcc-shared'
import {REGIONAL_WATCHTOWER_VIEW} from './map-viewport'

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8')

describe('Watchtower maritime focus around Qatar, Gulf and Red Sea',()=>{
  it('defaults to the user-selected Gulf / Hormuz / Red Sea corridor, with a world-map option',()=>{
    expect(REGIONAL_WATCHTOWER_VIEW.box).toEqual([9,31,36,68])
    expect(REGIONAL_WATCHTOWER_VIEW.lat).toBeGreaterThan(20)
    expect(REGIONAL_WATCHTOWER_VIEW.lon).toBeGreaterThan(45)
    const ui=read('components/dashboard/watchtower/global-watchtower.tsx')
    const map=read('components/dashboard/watchtower/global-tracking-map.tsx')
    expect(ui).toContain("useState<Region>('gulf')")
    expect(ui).toContain('Regional waters')
    expect(ui).toContain("setView('global')")
    expect(map).toContain('REGIONAL_WATCHTOWER_VIEW.lat,REGIONAL_WATCHTOWER_VIEW.lon')
    expect(map).toContain('ESRI_POLITICAL_BASE')
  })
  it('uses verifiable regional source URLs and keeps the original licensed API hub list unchanged',()=>{
    const expected=['AEFJR','OMSOH','OMSLL','SADMM','SAJUB',
      'BHKBS','IQUQR','SAJED','DJJIB','YEADE']
    expect(REGIONAL_SCAN_PORTS.map(p=>p.id)).toEqual(expected)
    expect(GCC_PUBLIC_PORTS.map(p=>p.id)).toEqual([
      'AEJEA','QADOH','QARLF',...expected])
    expect(MONITORED_MARITIME_PORTS).toHaveLength(14)
    for(const port of REGIONAL_SCAN_PORTS){
      const url=new URL(port.url)
      expect(url.protocol).toBe('https:')
      expect(url.hostname).toBe('www.myshiptracking.com')
      expect(url.pathname).toMatch(/^\/ports\/port-of-[a-z0-9-]+-id-\d+$/)
      expect(port.lat).toBeGreaterThan(9)
      expect(port.lat).toBeLessThan(36)
      expect(port.lon).toBeGreaterThan(31)
      expect(port.lon).toBeLessThan(68)
    }
  })
  it('prioritizes the three original Python ports but scans every available region',()=>{
    const candidates:PublicVesselCandidate[]=GCC_PUBLIC_PORTS.flatMap(p=>
      Array.from({length:12},(_,i)=>({
        hubId:p.id as GccHubId,name:p.id+':'+i,
        url:'https://www.myshiptracking.com/vessels/'+p.id.toLowerCase()+'-'+i,
        event:'UNCONFIRMED' as const,
      })))
    const scanned=selectPublicGccCandidates(candidates)
    expect(scanned).toHaveLength(48)
    expect(new Set(scanned.map(p=>p.url)).size).toBe(48)
    for(const port of GCC_PUBLIC_PORTS){
      const samples=scanned.filter(p=>p.hubId===port.id)
      expect(samples.length).toBeGreaterThanOrEqual(2)
      expect(samples.length).toBeLessThanOrEqual(12)
    }
    for(const hub of ['AEJEA','QADOH','QARLF']){
      expect(scanned.filter(p=>p.hubId===hub).length).toBeGreaterThanOrEqual(8)
    }
    expect(selectPublicGccCandidates(candidates,2,20)).toHaveLength(20)
  })
  it('does not treat an open-sea absence of AIS as zero maritime traffic',()=>{
    const source=read('lib/watchtower/myshiptracking-public.ts')
    expect(source).toContain('Regional coverage is limited to port-linked source pages')
    expect(source).toContain("if(!response.ok)throw Error('MyShipTracking public website returned '+response.status)")
    expect(source).toContain("WATCHTOWER_MST_SCRAPE_ENABLED")
    expect(source).not.toContain('navigator.webdriver')
  })
})
