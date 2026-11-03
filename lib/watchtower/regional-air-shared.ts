/** Full geographic box of the requested Egypt-to-Pakistan Watchtower view.
 * Geometric API-query coverage is not proof of ADS-B receiver reception. */
import type {TrackingAsset} from './global-tracking'

export const REGIONAL_AIR_BOUNDS={south:7,west:25,north:42,east:80} as const
export const REGIONAL_AIR_BATCH_COUNT=6
export const AIR_GRID_LATITUDES=[10,16,22,28,34,40] as const
export const AIR_GRID_LONGITUDES=[27.75,33.25,38.75,44.25,49.75,55.25,60.75,66.25,71.75,77.25] as const
/** Every point in the box is <=250 NM from at least one centre (max 244 NM). */
export const REGIONAL_AIR_CENTERS=AIR_GRID_LATITUDES.flatMap((lat,batch)=>
  AIR_GRID_LONGITUDES.map((lon,index)=>({lat,lon,batch,index})))
export type RegionalAirBatch={
  source:'ADSB.lol regional grid'
  batch:number
  checkedAt:string
  state:'partial'|'unavailable'|'unconfigured'
  centers:number
  succeeded:number
  failed:number
  latestObservationAt:string|null
  assets:TrackingAsset[]
  note:string
}
