'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { FarmList } from '@/features/operations/farm-list';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FarmForm } from '@/features/operations/farm-form';

export default function FarmsPage() {
  const { locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFarms();
  }, []);

  const fetchFarms = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/operations/farms');
      if (response.ok) {
        const data = await response.json();
        setFarms(data);
      }
    } catch (error) {
      console.error('[v0] Error fetching farms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormClose = () => {
    setIsOpen(false);
    fetchFarms();
  };

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
        <Button onClick={() => setIsOpen(true)} size="lg">
          {locale === 'ar' ? '+ إضافة مزرعة' : '+ Add Farm'}
        </Button>
      </div>

      {/* Content */}
      <div className="border border-border rounded-lg p-6 bg-card">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </div>
        ) : farms.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {locale === 'ar' 
                ? 'لا توجد مزارع بعد' 
                : 'No farms yet'}
            </p>
            <Button onClick={() => setIsOpen(true)} variant="outline">
              {locale === 'ar' ? 'إنشاء المزرعة الأولى' : 'Create your first farm'}
            </Button>
          </div>
        ) : (
          <FarmList farms={farms} onRefresh={fetchFarms} />
        )}
      </div>

      {/* Create Farm Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {locale === 'ar' ? 'إضافة مزرعة جديدة' : 'Add New Farm'}
            </DialogTitle>
          </DialogHeader>
          <FarmForm onClose={handleFormClose} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
