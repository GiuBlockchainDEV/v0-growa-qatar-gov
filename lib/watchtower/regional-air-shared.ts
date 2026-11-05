/** Full geographic box of the requested Egypt-to-Pakistan Watchtower view.
 * Geometric API-query coverage is not proof of ADS-B receiver reception. */
import type {TrackingAsset} from './global-tracking'

export const REGIONAL_AIR_BOUNDS={south:7,west:25,north:42,east:80} as const
export const AIR_GRID_LATITUDES=[10,16,22,28,34,40] as const
export const AIR_GRID_LONGITUDES=[27.75,33.25,38.75,44.25,49.75,55.25,60.75,66.25,71.75,77.25] as const
/** Every point in the box is <=250 NM from at least one centre (max 244 NM). */
// Prioritize observed aircraft near Saudi and Yemeni air corridors before
// distant grid cells. This reorders actual ADS-B queries; no aircraft invented.
const CARGO_HUBS=[
 {lat:24.96,lon:46.7}, // Riyadh
 {lat:21.67,lon:39.15}, // Jeddah
 {lat:26.47,lon:49.8}, // Dammam
 {lat:18.24,lon:42.66}, // Abha
 {lat:16.9,lon:42.58}, // Jazan
 {lat:15.48,lon:44.22}, // Sana'a
 {lat:12.83,lon:45.03}, // Aden
 {lat:14.75,lon:42.98}, // Hodeidah
 {lat:25.3,lon:51.5},{lat:25.25,lon:55.36},{lat:24.45,lon:54.65},
 {lat:23.59,lon:58.28},{lat:24.91,lon:67.16},{lat:30.12,lon:31.41},
]
const proximity=(lat:number,lon:number)=>Math.min(...CARGO_HUBS.map(h=>{const x=(lon-h.lon)*Math.cos(lat*Math.PI/180),y=lat-h.lat;return x*x+y*y}))
/** Targeted airport/corridor probes come FIRST, with real ADS-B query results.
 * The original 60-circle full geographic grid follows unchanged. Prioritising
 * generic grid points alone never queried Riyadh/Sana'a/Muscat directly.
 * No flight positions or airframe/cargo identities are generated.
 */
export const REGIONAL_AIR_PRIORITY_HUBS=[
 {id:'riyadh',region:'Saudi Arabia',lat:24.96,lon:46.70},
 {id:'sanaa',region:'Yemen',lat:15.48,lon:44.22},
 {id:'muscat',region:'Oman',lat:23.59,lon:58.28},
 {id:'jeddah',region:'Saudi Arabia',lat:21.67,lon:39.15},
 {id:'aden',region:'Yemen',lat:12.83,lon:45.03},
 {id:'dammam',region:'Saudi Arabia',lat:26.47,lon:49.80},
 {id:'salalah',region:'Oman',lat:17.04,lon:54.09},
 {id:'abha',region:'Saudi Arabia',lat:18.24,lon:42.66},
 {id:'jazan',region:'Saudi Arabia',lat:16.90,lon:42.58},
 {id:'duqm',region:'Oman',lat:19.50,lon:57.63},
] as const
const coverageGrid=AIR_GRID_LATITUDES.flatMap((lat,row)=>
 AIR_GRID_LONGITUDES.map((lon,col)=>({lat,lon,index:row*10+col})))
 .sort((a,b)=>proximity(a.lat,a.lon)-proximity(b.lat,b.lon)||a.index-b.index)
export const REGIONAL_AIR_CENTERS=[
 ...REGIONAL_AIR_PRIORITY_HUBS.map((hub,index)=>({
  lat:hub.lat,lon:hub.lon,index:-(index+1),hub:hub.id,region:hub.region,
 })),
 ...coverageGrid.map(center=>({...center,hub:undefined,region:undefined})),
].map((center,order)=>({...center,batch:Math.floor(order/5)}))
export const REGIONAL_AIR_BATCH_COUNT=Math.ceil(REGIONAL_AIR_CENTERS.length/5)
export type RegionalAirBatch={
  source:'ADSB.lol regional grid'
  batch:number
  checkedAt:string
  state:'partial'|'unavailable'|'unconfigured'
  centers:number
  succeeded:number
  failed:number
  /** Public-source errors by type: HTTP status, timeout or parsing. */
  failureCodes:Record<string,number>
  /** Real successful search circles, including circles with no aircraft. */
  circles:{lat:number;lon:number;count:number;status:'ok'|'failed';code?:string
    hub?:string;region?:string}[]
  latestObservationAt:string|null
  assets:TrackingAsset[]
  note:string
}
