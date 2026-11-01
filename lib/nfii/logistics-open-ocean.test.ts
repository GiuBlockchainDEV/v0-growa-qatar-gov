import {describe,expect,it} from 'vitest'
import {calculateOpenOceanRoute,routeDistanceKm} from './logistics-open-ocean'
import {matchesRequestedSeaPorts} from './logistics-route-geometry'
import {getExportHub,QATAR_PORT,haversineKm} from './logistics-lanes'

describe('Real offline ocean-network fallback, never geographic straight lines',()=>{
  it('produces an ocean path for India into Qatar without a SeaRoutes token',()=>{
    const route=calculateOpenOceanRoute('IN')
    expect(route).not.toBeNull()
    if(!route)throw Error('Ocean grid routing unavailable for Mumbai to Hamad Port')
    expect(route.calculationSource).toBe('local_ocean_network')
    expect(route.km).toBeGreaterThan(1500)
    expect(route.durationDays).toBeGreaterThan(1)
    expect(route.geometry.length).toBeGreaterThan(0)
    const start=getExportHub('IN')!.sea
    expect(matchesRequestedSeaPorts(route.geometry,
      [start.lat,start.lon],[QATAR_PORT.lat,QATAR_PORT.lon])).toBe(true)
    expect(routeDistanceKm(route.geometry)).toBeGreaterThan(
      haversineKm(start,QATAR_PORT)*.92)
  },20000)
  it('computes Thailand Laem Chabang to Hamad Port without a SeaRoutes key',()=>{
    const hub=getExportHub('TH')!
    const route=calculateOpenOceanRoute('TH')
    expect(route, 'TH reference '+JSON.stringify(hub.sea)+' to '+JSON.stringify(QATAR_PORT)).not.toBeNull()
    if(!route)return
    expect(route.geometry.flat().length).toBeGreaterThan(20)
    expect(route.km).toBeGreaterThan(haversineKm(hub.sea,QATAR_PORT))
  },30000)
  it('returns missing without inventing a route for unsupported countries',()=>{
    expect(calculateOpenOceanRoute('XX')).toBeNull()
  })
})
