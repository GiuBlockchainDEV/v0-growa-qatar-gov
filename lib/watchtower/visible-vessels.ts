import type {TrackingAsset} from './global-tracking'

/** AIS speed threshold for all mapped vessels. 3 kn is included. */
export const MIN_MAPPED_VESSEL_KNOTS=3
const RECENT_SHIP_WINDOW_MS=12*60*60*1000
const BAB_LAST_KNOWN_WINDOW_MS=7*24*60*60*1000

/** The public Bab el-Mandeb feed can stop publishing for several days.
 * If a genuine source-dated Bab position is still within seven days, retain
 * it as LAST KNOWN (faded with its original timestamp), never as live.
 * Other providers/areas keep the normal twelve-hour limit.
 */
const babSource=(asset:TrackingAsset)=>
  asset.chokepointId==='bab_el_mandeb' &&
  asset.source.startsWith('hormuz.data-tracking.net')

export function visibleObservedVessel(asset:TrackingAsset,now=Date.now()):boolean{
  if(asset.kind!=='vessel'||asset.observationBasis==='webpage_capture')return false
  const age=now-Date.parse(asset.observedAt)
  return Number.isFinite(age)&&age>=-60000&&
    age<=(babSource(asset)?BAB_LAST_KNOWN_WINDOW_MS:RECENT_SHIP_WINDOW_MS)
}

export function isDelayedBabPosition(asset:TrackingAsset,now=Date.now()):boolean{
  return babSource(asset)&&visibleObservedVessel(asset,now)&&
    now-Date.parse(asset.observedAt)>RECENT_SHIP_WINDOW_MS
}

export function visibleUnderwayVessel(asset:TrackingAsset,now=Date.now()):boolean{
  return visibleObservedVessel(asset,now)&&
    asset.speedKnots!==null&&Number.isFinite(asset.speedKnots)&&
    asset.speedKnots>=MIN_MAPPED_VESSEL_KNOTS&&asset.speedKnots<=55
}
