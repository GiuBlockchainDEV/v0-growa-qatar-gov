'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, Edit } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Farm {
  id: string;
  name_en: string;
  name_ar: string;
  location: string;
  farm_type: string;
  size_hectares: number;
  status: 'active' | 'inactive' | 'maintenance';
}

interface FarmListProps {
  farms: Farm[];
  onRefresh: () => void;
}

export function FarmList({ farms, onRefresh }: FarmListProps) {
  const { locale } = useI18n();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (farmId: string) => {
    if (!window.confirm(locale === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure?')) {
      return;
    }

    try {
      setDeleting(farmId);
      const response = await fetch(`/api/operations/farms/${farmId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error('[v0] Error deleting farm:', error);
    } finally {
      setDeleting(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    if (locale === 'ar') {
      switch (status) {
        case 'active':
          return 'نشطة';
        case 'maintenance':
          return 'صيانة';
        case 'inactive':
          return 'غير نشطة';
        default:
          return status;
      }
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-3 font-semibold text-foreground">
              {locale === 'ar' ? 'الاسم' : 'Name'}
            </th>
            <th className="text-left px-4 py-3 font-semibold text-foreground">
              {locale === 'ar' ? 'الموقع' : 'Location'}
            </th>
            <th className="text-left px-4 py-3 font-semibold text-foreground">
              {locale === 'ar' ? 'النوع' : 'Type'}
            </th>
            <th className="text-left px-4 py-3 font-semibold text-foreground">
              {locale === 'ar' ? 'الحجم (هكتار)' : 'Size (ha)'}
            </th>
            <th className="text-left px-4 py-3 font-semibold text-foreground">
              {locale === 'ar' ? 'الحالة' : 'Status'}
            </th>
            <th className="text-right px-4 py-3 font-semibold text-foreground">
              {locale === 'ar' ? 'الإجراءات' : 'Actions'}
            </th>
          </tr>
        </thead>
        <tbody>
          {farms.map((farm) => (
            <tr key={farm.id} className="border-b border-border hover:bg-muted/50">
              <td className="px-4 py-3 font-medium">
                {locale === 'ar' ? farm.name_ar : farm.name_en}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{farm.location}</td>
              <td className="px-4 py-3 text-muted-foreground">{farm.farm_type}</td>
              <td className="px-4 py-3 text-muted-foreground">{farm.size_hectares}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(farm.status)}`}>
                  {getStatusLabel(farm.status)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      {locale === 'ar' ? 'تعديل' : 'Edit'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(farm.id)}
                      disabled={deleting === farm.id}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleting === farm.id ? (locale === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (locale === 'ar' ? 'حذف' : 'Delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
