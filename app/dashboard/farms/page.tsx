'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { Button } from '@/components/ui/button'
import { Plus, Search, Filter, Sprout, MapPin, Maximize2, MoreVertical } from 'lucide-react'

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
  const { locale } = useI18n()
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
        setError(err instanceof Error ? err.message : 'Failed to load farms')
      } finally {
        setLoading(false)
      }
    }

    if (!orgLoading && organization) {
      fetchFarms()
    }
  }, [organization, orgLoading])

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, { en: string; ar: string }> = {
      crop: { en: 'Crop', ar: 'محاصيل' },
      livestock: { en: 'Livestock', ar: 'ماشية' },
      aquaculture: { en: 'Aquaculture', ar: 'استزراع سمكي' },
    }
    return typeMap[type]?.[locale === 'ar' ? 'ar' : 'en'] || type
  }

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'inactive':
        return 'bg-muted text-muted-foreground border-border'
      case 'maintenance':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'crop':
        return <Sprout className="h-4 w-4" />
      case 'livestock':
        return <span className="text-sm">🐄</span>
      case 'aquaculture':
        return <span className="text-sm">🐟</span>
      default:
        return <Sprout className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {locale === 'ar' ? 'إدارة المزارع' : 'Farm Management'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {locale === 'ar' 
              ? 'إدارة ومراقبة جميع المزارع في المنظمة' 
              : 'Manage and monitor all farms in your organization'}
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium glow-primary">
          <Plus className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'إضافة مزرعة' : 'Add Farm'}
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={locale === 'ar' ? 'البحث في المزارع...' : 'Search farms...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 rounded-lg border border-border bg-secondary/50 px-4 pl-10 text-sm placeholder-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <Button variant="outline" className="border-border hover:bg-secondary hover:border-primary/30">
          <Filter className="h-4 w-4 mr-2" />
          {locale === 'ar' ? 'فلتر' : 'Filter'}
        </Button>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading || orgLoading ? (
          <div className="p-16 text-center">
            <div className="inline-flex flex-col items-center gap-4">
              <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <p className="text-sm text-muted-foreground">
                {locale === 'ar' ? 'جاري تحميل المزارع...' : 'Loading farms...'}
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-16 text-center">
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-6 py-4 inline-block">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        ) : farms.length === 0 ? (
          <div className="p-16 text-center">
            <div className="inline-flex flex-col items-center gap-4">
              <div className="rounded-xl bg-primary/10 p-4">
                <Sprout className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground mb-1">
                  {locale === 'ar' ? 'لا توجد مزارع بعد' : 'No farms yet'}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {locale === 'ar' 
                    ? 'أضف أول مزرعة لبدء تتبع العمليات' 
                    : 'Add your first farm to start tracking operations'}
                </p>
              </div>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" />
                {locale === 'ar' ? 'إنشاء أول مزرعة' : 'Create First Farm'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">
                    {locale === 'ar' ? 'المزرعة' : 'Farm'}
                  </th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">
                    {locale === 'ar' ? 'النوع' : 'Type'}
                  </th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">
                    {locale === 'ar' ? 'الموقع' : 'Location'}
                  </th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">
                    {locale === 'ar' ? 'الحجم' : 'Size'}
                  </th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">
                    {locale === 'ar' ? 'الحالة' : 'Status'}
                  </th>
                  <th className="text-right px-6 py-4 font-semibold text-muted-foreground uppercase text-xs tracking-wider">
                    {locale === 'ar' ? 'إجراءات' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {farms.map((farm) => (
                  <tr key={farm.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          {getTypeIcon(farm.type)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {locale === 'ar' ? farm.name_ar : farm.name_en}
                          </p>
                          <p className="text-xs text-muted-foreground">ID: {farm.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-xs font-medium text-foreground">
                        {getTypeLabel(farm.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{farm.location}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-foreground">
                        <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="tabular-nums">{farm.size_hectares} ha</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${getStatusStyles(farm.status)}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${farm.status === 'active' ? 'bg-green-400' : farm.status === 'maintenance' ? 'bg-amber-400' : 'bg-muted-foreground'}`} />
                        {locale === 'ar' 
                          ? farm.status === 'active' ? 'نشط' : farm.status === 'inactive' ? 'غير نشط' : 'صيانة'
                          : farm.status.charAt(0).toUpperCase() + farm.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-secondary">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {farms.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {locale === 'ar' 
              ? `عرض ${farms.length} مزرعة` 
              : `Showing ${farms.length} farms`}
          </span>
          <span>
            {locale === 'ar' ? 'آخر تحديث: الآن' : 'Last updated: Just now'}
          </span>
        </div>
      )}
    </div>
  )
}
