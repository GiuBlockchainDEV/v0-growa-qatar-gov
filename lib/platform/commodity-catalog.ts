export interface CommodityDefinition {
  id: string
  name: string
  nameAr: string
  cropAliases: string[]
  category: 'vegetable' | 'fruit' | 'grain' | 'livestock' | 'other'
}

export const COMMODITY_CATALOG: CommodityDefinition[] = [
  {
    id: 'tomato',
    name: 'Tomato',
    nameAr: 'طماطم',
    cropAliases: ['tomato', 'tomatoes', 'طماطم'],
    category: 'vegetable',
  },
  {
    id: 'cucumber',
    name: 'Cucumber',
    nameAr: 'خيار',
    cropAliases: ['cucumber', 'cucumbers', 'خيار'],
    category: 'vegetable',
  },
  {
    id: 'pepper',
    name: 'Pepper',
    nameAr: 'فلفل',
    cropAliases: ['pepper', 'peppers', 'bell pepper', 'فلفل'],
    category: 'vegetable',
  },
  {
    id: 'lettuce',
    name: 'Lettuce',
    nameAr: 'خس',
    cropAliases: ['lettuce', 'خس'],
    category: 'vegetable',
  },
  {
    id: 'date',
    name: 'Date',
    nameAr: 'تمر',
    cropAliases: ['date', 'dates', 'تمر'],
    category: 'fruit',
  },
  {
    id: 'barley',
    name: 'Barley',
    nameAr: 'شعير',
    cropAliases: ['barley', 'شعير'],
    category: 'grain',
  },
]

export function resolveCommodity(idOrName: string | null | undefined): CommodityDefinition | null {
  if (!idOrName?.trim()) return null
  const normalized = idOrName.trim().toLowerCase()
  return (
    COMMODITY_CATALOG.find(
      (commodity) =>
        commodity.id === normalized ||
        commodity.cropAliases.some((alias) => alias.toLowerCase() === normalized)
    ) || null
  )
}

export function matchCropToCommodity(cropName: string): CommodityDefinition | null {
  const normalized = cropName.trim().toLowerCase()
  return (
    COMMODITY_CATALOG.find((commodity) =>
      commodity.cropAliases.some((alias) => normalized.includes(alias.toLowerCase()))
    ) || null
  )
}
