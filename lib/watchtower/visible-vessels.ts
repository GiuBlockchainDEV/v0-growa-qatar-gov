import type {TrackingAsset} from './global-tracking'

/**
 * Operational traffic layer: hide berthed/anchored vessels, unknown speed and
 * source-only webpage captures. A ship underway must report SOG >=1.5 kn and
 * a source-observed position within 12 hours. Old fixes are not real-time;
 * this is not proof of a voyage.
 */
/** A real, source-dated vessel position can be visible even when stopped.
 * Its AIS fix must be no older than 12 hours, and webpage-only captures do
 * not qualify as dated positions. This is NOT proof of a current voyage. */
export function visibleObservedVessel(asset:TrackingAsset,now=Date.now()):boolean{
  if(asset.kind!=='vessel'||asset.observationBasis==='webpage_capture')return false
  const observed=Date.parse(asset.observedAt),age=now-observed
  return Number.isFinite(age)&&age>=-60000&&age<=12*60*60000
}
export function visibleUnderwayVessel(asset:TrackingAsset,now=Date.now()):boolean{
  return visibleObservedVessel(asset,now)&&
    asset.speedKnots!==null&&Number.isFinite(asset.speedKnots)&&
    asset.speedKnots>=1.5&&asset.speedKnots<=55
}
