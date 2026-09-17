import { harvestGetParcel } from '@/lib/harvest/client'
import { getDemoParcelGeojson } from '@/lib/harvest/demo-data'
import { geoJsonToHarvestFieldPolygon } from '@/lib/harvest/geojson'
import type { HarvestMapFieldRing } from '@/lib/harvest/types'

export async function loadHarvestClipRings(
  parcelId: string,
  demoMode: boolean
): Promise<HarvestMapFieldRing[][]> {
  try {
    const payload = demoMode
      ? getDemoParcelGeojson(parcelId)
      : await harvestGetParcel(parcelId)
    const polygon = geoJsonToHarvestFieldPolygon(payload?.geojson, {
      parcel_id: parcelId,
      name: 'Field',
      crop: '—',
    })
    return polygon?.rings.filter((ring) => ring.length >= 3) || []
  } catch {
    return []
  }
}
