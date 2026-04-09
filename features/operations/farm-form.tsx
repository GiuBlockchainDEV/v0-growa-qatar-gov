'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FarmFormProps {
  onClose: () => void;
}

export function FarmForm({ onClose }: FarmFormProps) {
  const { locale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name_en: '',
    name_ar: '',
    location: '',
    farm_type: 'crop',
    size_hectares: '',
    status: 'active',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/operations/farms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          size_hectares: parseFloat(formData.size_hectares),
        }),
      });

      if (response.ok) {
        onClose();
      }
    } catch (error) {
      console.error('[v0] Error creating farm:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {locale === 'ar' ? 'الاسم (الإنجليزية)' : 'Name (English)'}
        </label>
        <Input
          type="text"
          required
          value={formData.name_en}
          onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
          placeholder={locale === 'ar' ? 'أدخل الاسم' : 'Enter farm name'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {locale === 'ar' ? 'الاسم (العربية)' : 'Name (Arabic)'}
        </label>
        <Input
          type="text"
          required
          value={formData.name_ar}
          onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
          placeholder={locale === 'ar' ? 'أدخل الاسم' : 'أدخل الاسم'}
          dir="rtl"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {locale === 'ar' ? 'الموقع' : 'Location'}
        </label>
        <Input
          type="text"
          required
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          placeholder={locale === 'ar' ? 'أدخل الموقع' : 'Enter location'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {locale === 'ar' ? 'النوع' : 'Farm Type'}
        </label>
        <Select value={formData.farm_type} onValueChange={(value) => setFormData({ ...formData, farm_type: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="crop">{locale === 'ar' ? 'محاصيل' : 'Crop'}</SelectItem>
            <SelectItem value="livestock">{locale === 'ar' ? 'الماشية' : 'Livestock'}</SelectItem>
            <SelectItem value="aquaculture">{locale === 'ar' ? 'الاستزراع السمكي' : 'Aquaculture'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {locale === 'ar' ? 'الحجم (هكتار)' : 'Size (Hectares)'}
        </label>
        <Input
          type="number"
          step="0.1"
          required
          value={formData.size_hectares}
          onChange={(e) => setFormData({ ...formData, size_hectares: e.target.value })}
          placeholder={locale === 'ar' ? 'أدخل الحجم' : 'Enter size'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          {locale === 'ar' ? 'الحالة' : 'Status'}
        </label>
        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{locale === 'ar' ? 'نشطة' : 'Active'}</SelectItem>
            <SelectItem value="maintenance">{locale === 'ar' ? 'صيانة' : 'Maintenance'}</SelectItem>
            <SelectItem value="inactive">{locale === 'ar' ? 'غير نشطة' : 'Inactive'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          {locale === 'ar' ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ' : 'Save')}
        </Button>
      </div>
    </form>
  );
}
