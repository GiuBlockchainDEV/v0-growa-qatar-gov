'use client';

import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export default function FarmsPage() {
  const { locale } = useI18n();

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

      {/* Content - Placeholder */}
      <div className="border border-border rounded-lg p-12 bg-card text-center">
        <p className="text-muted-foreground text-lg mb-2">
          {locale === 'ar' 
            ? 'في انتظار اتصال قاعدة البيانات' 
            : 'Waiting for database connection'}
        </p>
        <p className="text-sm text-muted-foreground">
          {locale === 'ar' 
            ? 'يرجى إعادة تكوين تكامل Supabase' 
            : 'Please reconfigure Supabase integration'}
        </p>
      </div>
    </div>
  );
}
