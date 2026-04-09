-- Growa Qatar - Auth/Access Seed Data
-- Step 1.8: Initial country, organization, department, role, and legal-label setup

-- 1. Country Instance
INSERT INTO country_instances (
  id, country_code, name_en, name_ar, timezone, currency, 
  created_at, updated_at, is_active
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'QA',
  'Qatar',
  'قطر',
  'Asia/Qatar',
  'QAR',
  NOW(),
  NOW(),
  true
) ON CONFLICT (id) DO NOTHING;

-- 2. Branding Config
INSERT INTO branding_configs (
  id, country_instance_id, logo_url, primary_color, 
  secondary_color, font_family, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'https://example.com/logo.png',
  '#1F2937',
  '#10B981',
  'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Legal Label Set
INSERT INTO legal_label_sets (
  id, country_instance_id, label_key, label_en, label_ar, 
  tooltip_en, tooltip_ar, created_at
) VALUES
  ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
   'ministry', 'Ministry of Municipality & Environment', 'وزارة البلدية والبيئة',
   'Sovereign ministry responsible for agricultural policy', 'الوزارة السيادية المسؤولة عن السياسة الزراعية', NOW()),
  ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
   'food_security', 'Food Security Authority', 'سلطة الأمن الغذائي',
   'Authority managing food security operations', 'الهيئة المسؤولة عن عمليات الأمن الغذائي', NOW()),
  ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
   'private_operator', 'Private Agricultural Operator', 'المشغل الزراعي الخاص',
   'Licensed private operator managing agricultural assets', 'المشغل الخاص المرخص لإدارة الأصول الزراعية', NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Organizations
INSERT INTO organizations (
  id, country_instance_id, name_en, name_ar, org_type, 
  legal_label_set_id, is_active, created_at, updated_at
) VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
   'Ministry of Municipality & Environment', 'وزارة البلدية والبيئة', 'ministry',
   '00000000-0000-0000-0000-000000000201'::uuid, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
   'Hassad Food Company', 'شركة حصاد للغذاء', 'sovereign_entity',
   '00000000-0000-0000-0000-000000000202'::uuid, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid,
   'Qatar Development Bank', 'بنك قطر للتنمية', 'financial_institution',
   '00000000-0000-0000-0000-000000000202'::uuid, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 5. Departments
INSERT INTO departments (
  id, organization_id, name_en, name_ar, 
  department_type, is_active, created_at, updated_at
) VALUES
  ('20000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid,
   'Agricultural Operations', 'العمليات الزراعية', 'operations', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid,
   'Compliance & Audit', 'الامتثال والتدقيق', 'compliance', true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000003'::uuid, '10000000-0000-0000-0000-000000000002'::uuid,
   'Operations', 'العمليات', 'operations', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. Regions
INSERT INTO regions (
  id, organization_id, name_en, name_ar, 
  region_code, is_active, created_at, updated_at
) VALUES
  ('30000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid,
   'Central Region', 'المنطقة الوسطى', 'CR', true, NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid,
   'Northern Region', 'المنطقة الشمالية', 'NR', true, NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000003'::uuid, '10000000-0000-0000-0000-000000000002'::uuid,
   'Main Operations Zone', 'منطقة العمليات الرئيسية', 'MOZ', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 7. Role Templates
INSERT INTO role_templates (
  id, organization_id, role_name, role_name_ar, description,
  is_system_role, created_at, updated_at
) VALUES
  ('40000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid,
   'Org Master Admin', 'مسؤول المنظمة الرئيسي', 'Organization-wide administrator with user management',
   true, NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid,
   'Food Security Ops Director', 'مدير عمليات الأمن الغذائي', 'Director-level operational authority',
   true, NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000003'::uuid, '10000000-0000-0000-0000-000000000001'::uuid,
   'Agricultural Inspector', 'مفتش زراعي', 'Field-level inspection and compliance',
   true, NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000004'::uuid, '10000000-0000-0000-0000-000000000001'::uuid,
   'Analyst/Viewer', 'محلل / مشاهد', 'Read-only access for analysis',
   true, NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000005'::uuid, '10000000-0000-0000-0000-000000000002'::uuid,
   'Org Master Admin', 'مسؤول المنظمة الرئيسي', 'Organization-wide administrator',
   true, NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000006'::uuid, '10000000-0000-0000-0000-000000000002'::uuid,
   'Operations Officer', 'ضابط العمليات', 'Operational field role',
   true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 8. Permission Templates (sample for each role)
INSERT INTO permission_templates (
  id, role_template_id, action, resource_type, 
  scope_level, created_at
) VALUES
  -- Org Master Admin - Full access
  ('50000000-0000-0000-0000-000000000001'::uuid, '40000000-0000-0000-0000-000000000001'::uuid,
   'create', 'user', 'organization', NOW()),
  ('50000000-0000-0000-0000-000000000002'::uuid, '40000000-0000-0000-0000-000000000001'::uuid,
   'read', 'user', 'organization', NOW()),
  ('50000000-0000-0000-0000-000000000003'::uuid, '40000000-0000-0000-0000-000000000001'::uuid,
   'update', 'user', 'organization', NOW()),
  ('50000000-0000-0000-0000-000000000004'::uuid, '40000000-0000-0000-0000-000000000001'::uuid,
   'delete', 'user', 'organization', NOW()),
  -- Food Security Ops Director - Department level
  ('50000000-0000-0000-0000-000000000005'::uuid, '40000000-0000-0000-0000-000000000002'::uuid,
   'read', 'operation', 'department', NOW()),
  ('50000000-0000-0000-0000-000000000006'::uuid, '40000000-0000-0000-0000-000000000002'::uuid,
   'update', 'operation', 'department', NOW()),
  -- Agricultural Inspector - Field level
  ('50000000-0000-0000-0000-000000000007'::uuid, '40000000-0000-0000-0000-000000000003'::uuid,
   'read', 'inspection', 'region', NOW()),
  ('50000000-0000-0000-0000-000000000008'::uuid, '40000000-0000-0000-0000-000000000003'::uuid,
   'create', 'inspection', 'region', NOW()),
  -- Analyst/Viewer - Read-only
  ('50000000-0000-0000-0000-000000000009'::uuid, '40000000-0000-0000-0000-000000000004'::uuid,
   'read', 'report', 'organization', NOW())
ON CONFLICT (id) DO NOTHING;

-- 9. Test User Profile for Org Master Admin
-- Note: In production, users are created via Supabase Auth signup + invitation flow
-- This is a dev-only seed user (auth.users entry must be created separately via Supabase)

INSERT INTO profiles (
  id, email, first_name_en, first_name_ar, 
  last_name_en, last_name_ar, phone, is_active, created_at, updated_at
) VALUES (
  '60000000-0000-0000-0000-000000000001'::uuid,
  'admin@growa-qatar.test',
  'Test', 'اختبار',
  'Admin', 'مسؤول',
  '+974 4444 1111',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 10. Membership linking test admin to Ministry
INSERT INTO memberships (
  id, user_id, organization_id, role_template_id,
  department_id, region_id, joined_at, status
) VALUES (
  '70000000-0000-0000-0000-000000000001'::uuid,
  '60000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  '40000000-0000-0000-0000-000000000001'::uuid,
  NULL,
  NULL,
  NOW(),
  'active'::membership_status
) ON CONFLICT (id) DO NOTHING;

-- 11. Audit log entry for seed
INSERT INTO audit_logs (
  id, user_id, action, entity_type, entity_id,
  old_value, new_value, ip_address, created_at
) VALUES (
  '80000000-0000-0000-0000-000000000001'::uuid,
  NULL,
  'system_seed',
  'country_instance',
  '00000000-0000-0000-0000-000000000001'::uuid,
  NULL,
  'Qatar country instance and seed data initialized',
  '127.0.0.1',
  NOW()
) ON CONFLICT (id) DO NOTHING;
