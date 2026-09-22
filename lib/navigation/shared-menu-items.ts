export interface NavigationMenuItem {
  key: string
  label: string
  path: string
  icon: string
  backendRoute?: string
  section?: 'primary' | 'secondary'
  purpose?: string
  defaultContent?: string
  allowedActions?: string[]
  submenu?: Array<{ key: string; label: string }>
}

export const HARVEST_MENU_ITEM: NavigationMenuItem = {
  key: 'harvest',
  label: 'Harvest Prediction',
  path: '/dashboard?module=harvest',
  icon: 'Harvest',
}

export const WEATHER_MENU_ITEM: NavigationMenuItem = {
  key: 'weather',
  label: 'Weather',
  path: '/dashboard?module=weather',
  icon: 'CloudSun',
}
