import type {TrackingAsset} from './global-tracking'

/**
 * Operational traffic layer: hide berthed/anchored vessels, unknown speed and
 * source-only webpage captures. A ship underway must report SOG >=1.5 kn and
 * a source-observed position within 12 hours. Old fixes are not real-time;
 * this is not proof of a voyage.
 */
export function visibleUnderwayVessel(asset:TrackingAsset,now=Date.now()):boolean{
  if(asset.kind!=='vessel'||asset.observationBasis==='webpage_capture')return false
  if(asset.speedKnots===null||!Number.isFinite(asset.speedKnots)||
    asset.speedKnots<1.5||asset.speedKnots>55)return false
  const observed=Date.parse(asset.observedAt),age=now-observed
  return Number.isFinite(age)&&age>=-60000&&age<=12*60*60000
}
