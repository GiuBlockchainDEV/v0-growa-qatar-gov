'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { Plus, Search, Filter, MapPin } from 'lucide-react'
import { EmptyState, ErrorState, LoadingState, PageBody, PageHeader } from '@/components/brand/layout'
import { Button, Field } from '@/components/brand/ui'
import { StatusTag } from '@/components/brand/status'

interface Farm {
  id: string
  name_en: string
  name_ar: string
  location: string
  type: 'crop' | 'livestock' | 'aquaculture'
  size_hectares: number
  status: 'active' | 'inactive' | 'maintenance'
}

export default function FarmsPage() {
  const { locale, tr } = useI18n()
  const { organization, loading: orgLoading } = useOrganization()
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchFarms = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/operations/farms')
        if (!response.ok) throw new Error('Failed to fetch farms')
        const data = await response.json()
        setFarms(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : tr('Failed to load farms'))
      } finally {
        setLoading(false)
      }
    }

    if (!orgLoading && organization) {
      fetchFarms()
    }
  }, [organization, orgLoading])

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      crop: tr('Crop|farm type'),
      livestock: tr('Livestock'),
      aquaculture: tr('Aquaculture'),
    }
    return typeMap[type] || type
  }

  const STATUS_LEVEL: Record<string, string> = { active: 'good', maintenance: 'attention', inactive: 'unknown' }
  const statusLabel = (status: string) =>
    status === 'active'
      ? tr('Active')
      : status === 'inactive'
        ? tr('Inactive')
        : status === 'maintenance'
          ? tr('Maintenance')
          : status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <div className="h-full overflow-y-auto bg-background">
      <PageBody>
        <PageHeader
          eyebrow={tr('Farms and sites')}
          title={tr('Farm management')}
          subtitle={tr('Manage and monitor all farms in your organisation.')}
          actions={
            <Button>
              <Plus strokeWidth={1.5} className="h-4 w-4" />
              {tr('Add farm')}
            </Button>
          }
        />

        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <Field
            className="flex-1"
            aria-label={tr('Search farms')}
            placeholder={tr('Search farms…')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefix={<Search strokeWidth={1.5} className="h-4 w-4" />}
          />
          <Button variant="secondary">
            <Filter strokeWidth={1.5} className="h-4 w-4" />
            {tr('Filter')}
          </Button>
        </div>

        <div className="bg-card border border-line overflow-hidden" style={{ borderRadius: 'var(--radius-xl)' }}>
          {loading || orgLoading ? (
            <LoadingState label={tr('Loading farms…')} />
          ) : error ? (
            <div className="p-6"><ErrorState message={error} /></div>
          ) : farms.length === 0 ? (
            <EmptyState
              title={tr('No farms yet')}
              description={tr('Add your first farm to start tracking operations.')}
              action={
                <Button>
                  <Plus strokeWidth={1.5} className="h-4 w-4" />
                  {tr('Create first farm')}
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="g-table g-table--pad w-full">
                <thead>
                  <tr>
                    <th>{tr('Farm')}</th>
                    <th>{tr('Type')}</th>
                    <th>{tr('Location')}</th>
                    <th>{tr('Size')}</th>
                    <th>{tr('Status')}</th>
                    <th className="text-end"><span className="sr-only">{tr('Actions')}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {farms.map((farm) => (
                    <tr key={farm.id} className="border-t border-line hover:bg-muted transition-colors">
                      <td className="py-3">
                        <p className="text-content" style={{ fontWeight: 500 }}>
                          {locale === 'ar' ? farm.name_ar : farm.name_en}
                        </p>
                        <p className="text-[12px] text-content-soft font-mono">{farm.id.slice(0, 8)}</p>
                      </td>
                      <td className="py-3 text-content-soft">{getTypeLabel(farm.type)}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1.5 text-content-soft">
                          <MapPin strokeWidth={1.5} className="h-3.5 w-3.5" />
                          {farm.location}
                        </span>
                      </td>
                      <td className="py-3 tabular-nums text-content">{farm.size_hectares} <span className="text-content-soft text-[12px]">ha</span></td>
                      <td className="py-3"><StatusTag level={STATUS_LEVEL[farm.status] || 'unknown'} label={statusLabel(farm.status)} /></td>
                      <td className="py-3 text-end">
                        <Link href={`/dashboard/farms/${farm.id}`} className="g-btn g-btn--outline" style={{ height: 30, padding: '0 14px', fontSize: 13 }}>
                          {tr('Open')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {farms.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-[12px] text-content-soft">
            <span>{tr('Showing {count} farms', { count: farms.length })}</span>
            <span>{tr('Last updated: just now')}</span>
          </div>
        )}
      </PageBody>
    </div>
  )
}
