'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useOrganization } from '@/hooks/use-organization'
import { Button } from '@/components/ui/button'

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {locale === 'ar' ? 'المزارع' : 'Farms'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {locale === 'ar' 
              ? 'إدارة جميع المزارع في المنظمة' 
              : 'Manage all farms in your organization'}
          </p>
        </div>
        <Button size="lg" disabled>
          {locale === 'ar' ? '+ إضافة مزرعة' : '+ Add Farm'}
        </Button>
      </div>

      {/* Content */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        {loading || orgLoading ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">
              {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-red-500">{error}</p>
          </div>
        ) : farms.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground mb-4">
              {locale === 'ar' ? 'لا توجد مزارع بعد' : 'No farms yet'}
            </p>
            <Button disabled>
              {locale === 'ar' ? 'إنشاء أول مزرعة' : 'Create your first farm'}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold">
                    {locale === 'ar' ? 'الاسم' : 'Name'}
                  </th>
                  <th className="text-left px-6 py-3 font-semibold">
                    {locale === 'ar' ? 'النوع' : 'Type'}
                  </th>
                  <th className="text-left px-6 py-3 font-semibold">
                    {locale === 'ar' ? 'الموقع' : 'Location'}
                  </th>
                  <th className="text-left px-6 py-3 font-semibold">
                    {locale === 'ar' ? 'الحجم (هكتار)' : 'Size (ha)'}
                  </th>
                  <th className="text-left px-6 py-3 font-semibold">
                    {locale === 'ar' ? 'الحالة' : 'Status'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {farms.map((farm) => (
                  <tr key={farm.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-6 py-4">
                      {locale === 'ar' ? farm.name_ar : farm.name_en}
                    </td>
                    <td className="px-6 py-4">{getTypeLabel(farm.type)}</td>
                    <td className="px-6 py-4">{farm.location}</td>
                    <td className="px-6 py-4">{farm.size_hectares}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(farm.status)}`}>
                        {locale === 'ar' 
                          ? farm.status === 'active' ? 'نشط' : farm.status === 'inactive' ? 'غير نشط' : 'صيانة'
                          : farm.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
