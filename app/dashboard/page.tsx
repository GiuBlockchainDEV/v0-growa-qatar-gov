'use client'

import { useI18n } from '@/lib/i18n'
import { SatelliteMap } from '@/components/dashboard/satellite-map'

export default function DashboardPage() {
  const { locale } = useI18n()

  return <SatelliteMap locale={locale} />
}
