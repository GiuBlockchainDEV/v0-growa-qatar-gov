/**
 * Growa Qatar - Arabic Translations
 * Step 0.4: i18n baseline
 * 
 * Arabic translations with RTL support.
 * Keys are organized by feature/domain.
 */

const ar: Record<string, string> = {
  // Common
  'common.loading': 'جاري التحميل...',
  'common.error': 'حدث خطأ',
  'common.retry': 'إعادة المحاولة',
  'common.cancel': 'إلغاء',
  'common.confirm': 'تأكيد',
  'common.save': 'حفظ',
  'common.delete': 'حذف',
  'common.edit': 'تعديل',
  'common.view': 'عرض',
  'common.search': 'بحث',
  'common.filter': 'تصفية',
  'common.clear': 'مسح',
  'common.close': 'إغلاق',
  'common.back': 'رجوع',
  'common.next': 'التالي',
  'common.previous': 'السابق',
  'common.submit': 'إرسال',
  'common.or': 'أو',

  // App
  'app.name': 'جروا قطر',
  'app.tagline': 'منصة العمليات الزراعية السيادية',

  // Auth - Sign In
  'auth.sign_in': 'تسجيل الدخول',
  'auth.sign_in_subtitle': 'منصة العمليات الزراعية لدولة قطر',
  'auth.email': 'البريد الإلكتروني',
  'auth.password': 'كلمة المرور',
  'auth.forgot_password': 'هل نسيت كلمة المرور؟',
  'auth.have_invitation': 'لدي رمز دعوة',
  'auth.no_account_contact_admin': 'ليس لديك حساب؟ اتصل بمسؤول المنظمة الخاص بك',
  'auth.failed_attempts': 'محاولات فاشلة',

  // Auth - General
  'auth.signOut': 'تسجيل الخروج',
  'auth.resetPassword': 'إعادة تعيين كلمة المرور',

  // Watchtower
  'watchtower.title': 'برج المراقبة الزراعي القطري',
  'watchtower.subtitle': 'الوعي الوطني بالوضع والذكاء التشغيلي',
  'watchtower.loading': 'جاري تحميل برج المراقبة...',
  'watchtower.refresh': 'تحديث',
  'watchtower.last_refresh': 'آخر تحديث',
  'watchtower.data_coverage': 'تغطية البيانات',
  'watchtower.demo_mode': 'بيانات تجريبية',
  'watchtower.partial_degradation': 'تدهور جزئي',
  'watchtower.priority_signals': 'إشارات ذات أولوية',
  'watchtower.no_signals': 'لا توجد إشارات في النافذة الحالية',
  'watchtower.what_changed': 'ما الذي تغير',
  'watchtower.outlook': 'التوقعات',
  'watchtower.data_health': 'جودة البيانات',
  'watchtower.ai_briefing': 'ملخص Growa AI',
  'watchtower.ai_ready': 'ملخص AI جاهز',
  'watchtower.ai_available': 'AI متاح',
  'watchtower.national_map': 'خريطة الوضع الوطني',
  'watchtower.national_estimations': 'تقديرات الإنتاج الوطنية',
  'watchtower.layers_active': 'طبقات نشطة',
  'watchtower.alert_created': 'تم إنشاء التنبيه',
  'watchtower.upcoming_module': 'وحدة قادمة',
  'watchtower.upcoming_description': 'هذه الوحدة موجودة في التنقل ولكن التكامل الخلفي غير مكتمل بعد. استخدم برج المراقبة والوحدات المرتبطة للبيانات الحية.',

  'context.active': 'سياق نشط',
  'context.back_to_watchtower': 'العودة إلى برج المراقبة',
  'context.clear': 'مسح',

  'alerts.title': 'مركز التنبيهات',
  'alerts.subtitle': 'دورة حياة التنبيهات التشغيلية من إشارات برج المراقبة',
  'alerts.empty': 'لا توجد تنبيهات في الفلتر الحالي. أنشئ تنبيهات من إشارات برج المراقبة.',
  'alerts.from_watchtower': 'فتح برج المراقبة الوطني',
  'alerts.migration_required': 'يتطلب تخزين التنبيهات ترحيل قاعدة البيانات 00028_operational_alerts.',
  'alerts.workflow_note': 'يمكن ترقية الإشارات من برج المراقبة إلى تنبيهات تشغيلية مع دورة حياة كاملة.',

  'module.investigate_via': 'التحقيق عبر الوحدات المرتبطة',

  'nav.area.watchtower': 'برج المراقبة',
  'nav.area.operations': 'العمليات',
  'nav.area.intelligence': 'الذكاء',
  'nav.area.food_security': 'الأمن الغذائي',
  'nav.area.risk_response': 'المخاطر والاستجابة',
  'nav.area.governance': 'الحوكمة',
  'nav.area.ai_operations': 'عمليات الذكاء الاصطناعي',
  'nav.area.platform': 'المنصة',

  'nav.section.watchtower': 'برج المراقبة',
  'nav.section.operations': 'العمليات',
  'nav.section.intelligence': 'الذكاء',
  'nav.section.food_security': 'الأمن الغذائي',
  'nav.section.risk_compliance': 'المخاطر والامتثال',
  'nav.section.collaboration': 'التعاون',
  'nav.section.feeds': 'مصادر المعلومات',
  'nav.section.platform': 'المنصة',

  // Navigation
  'nav.dashboard': 'لوحة التحكم',
  'nav.map': 'خريطة العمليات',
  'nav.alerts': 'التنبيهات',
  'nav.inspections': 'التفتيشات',
  'nav.reports': 'التقارير',
  'nav.settings': 'الإعدادات',
  'nav.admin': 'الإدارة',

  // Status
  'status.healthy': 'سليم',
  'status.warning': 'تحذير',
  'status.critical': 'حرج',
  'status.offline': 'غير متصل',
  'status.pending': 'قيد الانتظار',
  'status.active': 'نشط',
  'status.suspended': 'معلق',
  'status.revoked': 'ملغي',

  // Organizations
  'org.ministry': 'وزارة',
  'org.sovereign': 'جهة سيادية',
  'org.stateOperator': 'مشغل حكومي',
  'org.financial': 'مؤسسة مالية',
  'org.research': 'جهة بحثية',
  'org.external': 'مشغل خارجي',

  // Direction
  'direction.ltr': 'من اليسار إلى اليمين',
  'direction.rtl': 'من اليمين إلى اليسار',
  'language.english': 'الإنجليزية',
  'language.arabic': 'العربية',
  'language.switch': 'تغيير اللغة',

  // Operations - Farms
  'operations.farms': 'المزارع',
  'operations.farms_description': 'إدارة جميع المزارع في المنظمة',
  'operations.add_farm': 'إضافة مزرعة',
  'operations.create_farm': 'إضافة مزرعة جديدة',
  'operations.farm_name_en': 'اسم المزرعة (الإنجليزية)',
  'operations.farm_name_ar': 'اسم المزرعة (العربية)',
  'operations.farm_location': 'الموقع',
  'operations.farm_type': 'نوع المزرعة',
  'operations.farm_size': 'الحجم (هكتار)',
  'operations.farm_status': 'الحالة',
  'operations.farm_type_crop': 'محاصيل',
  'operations.farm_type_livestock': 'ماشية',
  'operations.farm_type_aquaculture': 'استزراع سمكي',
  'operations.status_active': 'نشط',
  'operations.status_inactive': 'غير نشط',
  'operations.status_maintenance': 'صيانة',
  'operations.no_farms': 'لا توجد مزارع بعد',
  'operations.create_first_farm': 'إنشاء أول مزرعة',

  // Operations - Cycles
  'operations.cycles': 'دورات الإنتاج',
  'operations.cycles_description': 'تتبع دورات النمو والتربية',

  // Operations - Inventory
  'operations.inventory': 'المخزون',
  'operations.inventory_description': 'إدارة المدخلات والموارد',

  // Operations - General
  'operations.create': 'إنشاء',
  'operations.edit': 'تعديل',
  'operations.delete': 'حذف',
  'operations.actions': 'الإجراءات',
  'operations.save': 'حفظ',
  'operations.cancel': 'إلغاء',
  'operations.deleting': 'جاري الحذف...',
  'operations.confirm_delete': 'هل أنت متأكد؟',
}

export default ar
