/*
 * Fixed English strings that come from the server (watchtower summary
 * labels, units, source names, health states, timeframes) and are
 * translated where they are displayed. Free text produced by the server
 * (signal titles, summaries, change descriptions) is not covered: it needs
 * the API to answer in the requested language.
 */
export const SERVER_AR: Record<string, string> = {
  // Timeframes
  now: 'الآن',
  '24h': '24 ساعة',
  '7d': '7 أيام',
  '30d': '30 يومًا',
  season: 'الموسم',
  // KPI labels
  'Observed production': 'الإنتاج المرصود',
  'Forecast biomass': 'الكتلة الحيوية المتوقعة',
  'Forecast biomass (TBP)': 'الكتلة الحيوية المتوقعة (TBP)',
  'Crop types': 'أنواع المحاصيل',
  'Avg vegetation score': 'متوسط درجة الغطاء النباتي',
  'Total water demand': 'إجمالي الطلب على المياه',
  // Units written as words
  field: 'حقل',
  crop: 'محصول',
  crops: 'محاصيل',
  // Metric sources
  'Operational crop insights': 'بيانات المحاصيل التشغيلية',
  'Harvest forecast model': 'نموذج توقعات الحصاد',
  'Harvest analytics': 'تحليلات الحصاد',
  'Active signals': 'الإشارات النشطة',
  'Weather monitoring': 'رصد الطقس',
  'Supply contracts': 'عقود الإمداد',
  // Source health and data quality
  Healthy: 'سليم',
  Degraded: 'متدهور',
  Stale: 'قديم',
  Offline: 'غير متصل',
  Fresh: 'محدَّث',
  Missing: 'مفقود',
  Unavailable: 'غير متاح',
  // Password field
  Weak: 'ضعيفة',
  Strong: 'قوية',
  'Password strength': 'قوة كلمة المرور',
}
