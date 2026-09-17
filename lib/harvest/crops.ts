import type { HarvestCropGroup, HarvestCropOption } from '@/lib/harvest/types'

export function groupOpenFieldCrops(crops: HarvestCropOption[]): HarvestCropGroup[] {
  const grouped = new Map<string, Array<{ value: number; label: string }>>()

  for (const crop of crops) {
    if (crop.field_type !== 'open_field') continue
    const bucket = grouped.get(crop.cultivation_method) || []
    bucket.push({ value: crop.id, label: crop.name })
    grouped.set(crop.cultivation_method, bucket)
  }

  return Array.from(grouped.entries()).map(([label, options]) => ({
    label,
    options,
  }))
}
