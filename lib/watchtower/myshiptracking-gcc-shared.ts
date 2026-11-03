/** Client-safe GCC radar constants and DTO types; never import server-side
 * AIS, route-geometry or node:fs dependencies from a React component. */
import type {TrackingAsset} from './global-tracking'
export const GCC_RADAR_INTERVAL_MS=5*60000
export const GCC_RADAR_MIN_SPEED_KNOTS=1.5
export const GCC_PORTS=[
  {id:'AEJEA',label:'Jebel Ali · Dubai (UAE)',lat:25.02413,lon:55.04112,unloco:'AEJEA'},
  {id:'QAHMD',label:'Hamad Port (Qatar)',lat:25.02946,lon:51.62450,unloco:'QAHMD'},
  {id:'QADOH',label:'Doha Port (Qatar)',lat:25.30644,lon:51.54737,unloco:'QADOH'},
  {id:'QARLF',label:'Ras Laffan (Qatar)',lat:25.91669,lon:51.62693,unloco:'QARLF'},
] as const
export type GccHubId=typeof GCC_PORTS[number]['id']
export type GccRadarState='not_configured'|'available'|'partial'|'unavailable'
export type GccHubReport={
  id:GccHubId;label:string;status:GccRadarState
  candidates:number;observed:number;withRoutes:number
  sourceUrl:string;detail:string
}
export type GccRadarSnapshot={
  generatedAt:string;refreshSeconds:300;source:'MyShipTracking API'|'MyShipTracking public pages'
  status:GccRadarState;configured:boolean
  hubs:GccHubReport[];assets:TrackingAsset[];sourceUrl:string
  checked:number;moving:number;withRoutes:number
  sourceNote:string;maxShipsPerHub:number
  creditsCharged:number|null
}
