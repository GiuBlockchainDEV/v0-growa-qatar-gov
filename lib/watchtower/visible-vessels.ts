import type {TrackingAsset} from './global-tracking'

/** Operational visibility contract: only verified source-aged fixes from the last hour. */
export const MIN_MAPPED_VESSEL_KNOTS=5.1
export const MAX_MAPPED_VESSEL_AGE_MS=60*60*1000

/** A provider's polling timestamp is not an individual ship position fix.
 * Exclude undated webpage captures and snapshot-only poll timestamps to
 * avoid painting potentially old coordinates as last-hour traffic. */
export function visibleObservedVessel(asset:TrackingAsset,now=Date.now()):boolean{
  if(asset.kind!=='vessel'||
    asset.observationBasis==='webpage_capture'||
    asset.observationBasis==='snapshot_poll')return false
  // A just-received live WebSocket message is a real observation even when
  // the AIS payload lacks a trustworthy ship GPS fix timestamp.
  // Keep the receipt-time qualifier visible, and apply a tighter age limit.
  const age=now-Date.parse(asset.observedAt)
  const limit=asset.observationBasis==='receipt_time'?10*60000:MAX_MAPPED_VESSEL_AGE_MS
  return Number.isFinite(age)&&age>=-60000&&age<=limit
}

export function visibleUnderwayVessel(asset:TrackingAsset,now=Date.now()):boolean{
  return visibleObservedVessel(asset,now)&&
    asset.speedKnots!==null&&Number.isFinite(asset.speedKnots)&&
    asset.speedKnots>=MIN_MAPPED_VESSEL_KNOTS&&asset.speedKnots<=55
}
