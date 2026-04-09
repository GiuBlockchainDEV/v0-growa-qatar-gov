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
}

export default ar
