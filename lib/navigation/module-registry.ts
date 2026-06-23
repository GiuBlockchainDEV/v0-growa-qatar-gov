export type OrgType = 'government_master' | 'government' | 'farm_company' | 'private' | 'public'
export type SharedLayer = 'regulatory' | 'commercial' | 'finance' | 'technical_support'
export type VisibilityLevel = 'FULL' | 'SUMMARY' | 'APPROVAL' | 'NO'

export type PermissionFlag =
  | 'canView'
  | 'canEdit'
  | 'canManageUsers'
  | 'canDeleteOrganization'
  | 'canShareData'
  | 'canViewRegulatory'
  | 'canViewCommercial'
  | 'canViewFinance'
  | 'canViewTechnical'

export type MinistryRoleProfile = 'ministry_admin' | 'ministry_inspector'

export interface ModuleSubmenuItem {
  key: string
  label: string
}

interface RoleAwareLabel {
  default: string
  byRole?: Partial<Record<MinistryRoleProfile, string>>
}

interface RoleAwareSubmenu {
  default: ModuleSubmenuItem[]
  byRole?: Partial<Record<MinistryRoleProfile, ModuleSubmenuItem[]>>
}

export interface ModuleVisibilityScope {
  allowedOrgTypes: OrgType[] | '*'
  requiredPermissions: PermissionFlag[]
  requiredLayerVisibility?: Partial<Record<SharedLayer, VisibilityLevel[]>>
}

export interface ModuleDefinition {
  id: string
  backendRoute: '/dashboard'
  icon: string
  label: RoleAwareLabel
  purpose: string
  defaultContent: string
  allowedActions: string[]
  visibilityScope: ModuleVisibilityScope
  submenu: RoleAwareSubmenu
}

export interface ResolvedModuleDefinition {
  id: string
  backendRoute: '/dashboard'
  href: string
  icon: string
  label: string
  purpose: string
  defaultContent: string
  allowedActions: string[]
  visibilityScope: ModuleVisibilityScope
  submenu: ModuleSubmenuItem[]
}

interface RoleMenuBlueprint {
  defaultLandingModule: string
  primary: string[]
  secondary: string[]
}

export interface NavigationContext {
  orgType: OrgType | null
  permissions: Partial<Record<PermissionFlag, boolean>>
  visibilityByLayer: Partial<Record<SharedLayer, VisibilityLevel>>
}

export interface ResolvedRoleNavigation {
  roleProfile: MinistryRoleProfile
  landingModuleId: string
  landingPage: string
  primary: ResolvedModuleDefinition[]
  secondary: ResolvedModuleDefinition[]
}

const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  'national-overview': {
    id: 'national-overview',
    backendRoute: '/dashboard',
    icon: 'Globe',
    label: { default: 'National Overview' },
    purpose: 'Provide sovereign executive situational awareness across regions and programs.',
    defaultContent: 'Executive summary with priorities, KPIs, hotspots, and recent critical changes.',
    allowedActions: ['View national summary', 'Drill down by region', 'Pin executive priority views'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canView'],
      requiredLayerVisibility: { regulatory: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'executive-summary', label: 'Executive Summary' },
        { key: 'todays-priorities', label: "Today's Priorities" },
        { key: 'national-kpis', label: 'National KPIs' },
        { key: 'risk-hotspots', label: 'Risk Hotspots' },
        { key: 'program-status', label: 'Program Status' },
        { key: 'recent-critical-changes', label: 'Recent Critical Changes' },
      ],
    },
  },
  'inspection-dashboard': {
    id: 'inspection-dashboard',
    backendRoute: '/dashboard',
    icon: 'CheckCircle',
    label: { default: 'Inspection Dashboard' },
    purpose: 'Manage inspector workload, due items, and completion performance.',
    defaultContent: 'My queue with due inspections, findings, and completion status.',
    allowedActions: ['Prioritize queue', 'Assign follow-ups', 'Open case from queue'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canView', 'canViewRegulatory'],
      requiredLayerVisibility: { regulatory: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'my-queue', label: 'My Queue' },
        { key: 'due-this-week', label: 'Due This Week' },
        { key: 'high-priority-cases', label: 'High Priority Cases' },
        { key: 'assigned-regions', label: 'Assigned Regions' },
        { key: 'open-findings', label: 'Open Findings' },
        { key: 'completion-status', label: 'Completion Status' },
      ],
    },
  },
  'live-map': {
    id: 'live-map',
    backendRoute: '/dashboard',
    icon: 'Map',
    label: { default: 'Live Map' },
    purpose: 'Operate from the map as the primary spatial decision surface.',
    defaultContent: 'Map-first operational view with layers, search, filters, and saved views.',
    allowedActions: ['Switch map scope', 'Apply layer presets', 'Save operational map views'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government', 'farm_company'],
      requiredPermissions: ['canView'],
    },
    submenu: {
      default: [
        { key: 'national-map', label: 'National Map' },
        { key: 'regional-map', label: 'Regional Map' },
        { key: 'saved-views', label: 'Saved Views' },
        { key: 'layer-presets', label: 'Layer Presets' },
        { key: 'search-locate', label: 'Search & Locate' },
        { key: 'map-filters', label: 'Map Filters' },
      ],
      byRole: {
        ministry_inspector: [
          { key: 'inspection-map', label: 'Inspection Map' },
          { key: 'inspection-routes', label: 'Inspection Routes' },
          { key: 'site-search', label: 'Site Search' },
          { key: 'nearby-cases', label: 'Nearby Cases' },
          { key: 'map-filters', label: 'Map Filters' },
        ],
      },
    },
  },
  monitoring: {
    id: 'monitoring',
    backendRoute: '/dashboard',
    icon: 'Activity',
    label: { default: 'Monitoring' },
    purpose: 'Monitor high-level environmental and data health signals for national operations.',
    defaultContent: 'Institutional summary views for environment, water, weather, and trend coverage.',
    allowedActions: ['Compare trend windows', 'Open hotspot in map', 'Export monitoring snapshot'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canView', 'canViewRegulatory'],
      requiredLayerVisibility: { regulatory: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'environmental-summary', label: 'Environmental Summary' },
        { key: 'water-summary', label: 'Water Summary' },
        { key: 'weather-risk', label: 'Weather Risk' },
        { key: 'telemetry-kpi-overview', label: 'Telemetry KPI Overview' },
        { key: 'monitoring-trends', label: 'Monitoring Trends' },
        { key: 'data-coverage', label: 'Data Coverage' },
      ],
    },
  },
  'alerts-center': {
    id: 'alerts-center',
    backendRoute: '/dashboard',
    icon: 'AlertTriangle',
    label: {
      default: 'Alerts & Risks',
      byRole: { ministry_inspector: 'Alerts & Incidents' },
    },
    purpose: 'Coordinate triage, escalation, and closure of operational and compliance risk events.',
    defaultContent: 'Alert stream with risk context, escalations, and open vs closed trends.',
    allowedActions: ['Acknowledge alerts', 'Escalate incidents', 'Link alerts to cases'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canView', 'canViewRegulatory'],
      requiredLayerVisibility: { regulatory: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'alert-center', label: 'Alert Center' },
        { key: 'critical-incidents', label: 'Critical Incidents' },
        { key: 'risk-hotspots', label: 'Risk Hotspots' },
        { key: 'escalations', label: 'Escalations' },
        { key: 'open-investigations', label: 'Open Investigations' },
        { key: 'resolved-vs-open-trends', label: 'Resolved vs Open Trends' },
      ],
      byRole: {
        ministry_inspector: [
          { key: 'compliance-alerts', label: 'Compliance Alerts' },
          { key: 'linked-incidents', label: 'Linked Incidents' },
          { key: 'field-escalations', label: 'Field Escalations' },
          { key: 'urgent-site-visits', label: 'Urgent Site Visits' },
        ],
      },
    },
  },
  'compliance-inspections': {
    id: 'compliance-inspections',
    backendRoute: '/dashboard',
    icon: 'CheckSquare',
    label: { default: 'Compliance & Inspections' },
    purpose: 'Track compliance posture, inspections, and regulatory execution quality.',
    defaultContent: 'Inspection planning, non-conformity pipeline, and compliance score trends.',
    allowedActions: ['Plan inspections', 'Review corrective actions', 'Generate regulatory report'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canViewRegulatory'],
      requiredLayerVisibility: { regulatory: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'inspection-dashboard', label: 'Inspection Dashboard' },
        { key: 'inspection-plans', label: 'Inspection Plans' },
        { key: 'non-conformities', label: 'Non-Conformities' },
        { key: 'corrective-actions', label: 'Corrective Actions' },
        { key: 'compliance-score', label: 'Compliance Score' },
        { key: 'regulatory-reports', label: 'Regulatory Reports' },
      ],
    },
  },
  'production-harvest': {
    id: 'production-harvest',
    backendRoute: '/dashboard',
    icon: 'Sprout',
    label: { default: 'Production & Harvest' },
    purpose: 'Assess production readiness and harvest risk for sovereign food security planning.',
    defaultContent: 'Outlook and forecast views by region with delayed zones and supply risk signals.',
    allowedActions: ['Review forecast deltas', 'Open delayed zones in map', 'Export production outlook'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canViewCommercial'],
      requiredLayerVisibility: { commercial: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'production-outlook', label: 'Production Outlook' },
        { key: 'harvest-forecast', label: 'Harvest Forecast' },
        { key: 'regional-readiness', label: 'Regional Readiness' },
        { key: 'delayed-zones', label: 'Delayed Zones' },
        { key: 'crop-portfolio', label: 'Crop Portfolio' },
        { key: 'supply-risk-signals', label: 'Supply Risk Signals' },
      ],
    },
  },
  'inter-agency-collaboration': {
    id: 'inter-agency-collaboration',
    backendRoute: '/dashboard',
    icon: 'Link',
    label: { default: 'Inter-Agency Collaboration' },
    purpose: 'Coordinate secure case and data exchange across sovereign partner agencies.',
    defaultContent: 'Shared cases, approvals, visibility rules, and collaboration audit log.',
    allowedActions: ['Review data requests', 'Approve cross-agency views', 'Audit collaboration history'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canShareData'],
      requiredLayerVisibility: { regulatory: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'shared-cases', label: 'Shared Cases' },
        { key: 'shared-data-requests', label: 'Shared Data Requests' },
        { key: 'pending-approvals', label: 'Pending Approvals' },
        { key: 'cross-agency-views', label: 'Cross-Agency Views' },
        { key: 'visibility-rules', label: 'Visibility Rules' },
        { key: 'collaboration-log', label: 'Collaboration Log' },
      ],
    },
  },
  'programs-policy': {
    id: 'programs-policy',
    backendRoute: '/dashboard',
    icon: 'Briefcase',
    label: { default: 'Programs & Policy' },
    purpose: 'Track public programs and policy implementation performance by region.',
    defaultContent: 'Enrollment status, exceptions, incentive monitoring, and policy outcomes.',
    allowedActions: ['Review program exceptions', 'Compare regional coverage', 'Monitor policy performance'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canViewRegulatory'],
      requiredLayerVisibility: { regulatory: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'public-programs', label: 'Public Programs' },
        { key: 'enrollment-status', label: 'Enrollment Status' },
        { key: 'program-exceptions', label: 'Program Exceptions' },
        { key: 'incentive-monitoring', label: 'Incentive Monitoring' },
        { key: 'regional-coverage', label: 'Regional Coverage' },
        { key: 'policy-performance', label: 'Policy Performance' },
      ],
    },
  },
  'reports-center': {
    id: 'reports-center',
    backendRoute: '/dashboard',
    icon: 'BarChart3',
    label: {
      default: 'Reports & Analytics',
      byRole: { ministry_inspector: 'Reports' },
    },
    purpose: 'Provide institutional reporting for executive and regulatory stakeholders.',
    defaultContent: 'Executive, compliance, water-use, production, and program report packages.',
    allowedActions: ['Generate report package', 'Schedule exports', 'Download analytics artifacts'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canView'],
    },
    submenu: {
      default: [
        { key: 'executive-reports', label: 'Executive Reports' },
        { key: 'compliance-reports', label: 'Compliance Reports' },
        { key: 'water-use-reports', label: 'Water Use Reports' },
        { key: 'production-reports', label: 'Production Reports' },
        { key: 'program-reports', label: 'Program Reports' },
        { key: 'export-center', label: 'Export Center' },
      ],
      byRole: {
        ministry_inspector: [
          { key: 'inspection-reports', label: 'Inspection Reports' },
          { key: 'regional-summary', label: 'Regional Summary' },
          { key: 'non-conformity-summary', label: 'Non-Conformity Summary' },
          { key: 'closure-metrics', label: 'Closure Metrics' },
          { key: 'export', label: 'Export' },
        ],
      },
    },
  },
  'compliance-cases': {
    id: 'compliance-cases',
    backendRoute: '/dashboard',
    icon: 'FileText',
    label: { default: 'Compliance Cases' },
    purpose: 'Manage end-to-end lifecycle of compliance cases and evidence readiness.',
    defaultContent: 'Case queue grouped by state, evidence completeness, and escalation status.',
    allowedActions: ['Open case', 'Move case stage', 'Escalate case'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canViewRegulatory'],
      requiredLayerVisibility: { regulatory: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'open-cases', label: 'Open Cases' },
        { key: 'in-review', label: 'In Review' },
        { key: 'awaiting-evidence', label: 'Awaiting Evidence' },
        { key: 'closed-cases', label: 'Closed Cases' },
        { key: 'escalated-cases', label: 'Escalated Cases' },
      ],
    },
  },
  'non-conformities': {
    id: 'non-conformities',
    backendRoute: '/dashboard',
    icon: 'AlertCircle',
    label: { default: 'Non-Conformities' },
    purpose: 'Track severity, recurrence, and regional spread of non-conformities.',
    defaultContent: 'Open non-conformities by severity, geography, and repeat offenders.',
    allowedActions: ['Filter by severity', 'Group by region', 'Inspect repeat offenders'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canViewRegulatory'],
      requiredLayerVisibility: { regulatory: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'open-non-conformities', label: 'Open Non-Conformities' },
        { key: 'severity-breakdown', label: 'Severity Breakdown' },
        { key: 'by-region', label: 'By Region' },
        { key: 'by-farm', label: 'By Farm' },
        { key: 'repeat-offenders', label: 'Repeat Offenders' },
      ],
    },
  },
  'corrective-actions': {
    id: 'corrective-actions',
    backendRoute: '/dashboard',
    icon: 'CheckSquare',
    label: { default: 'Corrective Actions' },
    purpose: 'Monitor corrective action execution and verification closure timelines.',
    defaultContent: 'Open, overdue, pending verification, and closed corrective action queues.',
    allowedActions: ['Track overdue actions', 'Verify action completion', 'Close corrective action'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canViewRegulatory'],
      requiredLayerVisibility: { regulatory: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'open-actions', label: 'Open Actions' },
        { key: 'overdue-actions', label: 'Overdue Actions' },
        { key: 'pending-verification', label: 'Pending Verification' },
        { key: 'closed-actions', label: 'Closed Actions' },
      ],
    },
  },
  'farms-sites': {
    id: 'farms-sites',
    backendRoute: '/dashboard',
    icon: 'Home',
    label: { default: 'Farms & Sites' },
    purpose: 'Provide institutional registry views of farms, sites, and production units.',
    defaultContent: 'Registry-centered views with historical context and related operational records.',
    allowedActions: ['Locate site in map', 'Open related history', 'Review unit metadata'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government', 'farm_company'],
      requiredPermissions: ['canView'],
    },
    submenu: {
      default: [
        { key: 'farms-registry', label: 'Farms Registry' },
        { key: 'sites', label: 'Sites' },
        { key: 'greenhouses', label: 'Greenhouses' },
        { key: 'production-units', label: 'Production Units' },
        { key: 'related-history', label: 'Related History' },
      ],
    },
  },
  'evidence-attachments': {
    id: 'evidence-attachments',
    backendRoute: '/dashboard',
    icon: 'Paperclip',
    label: { default: 'Evidence & Attachments' },
    purpose: 'Manage inspection evidence lifecycle for traceable compliance decisions.',
    defaultContent: 'Evidence uploads, missing artifacts, signed reports, and attachment health.',
    allowedActions: ['Upload evidence', 'Review missing artifacts', 'Link evidence to case'],
    visibilityScope: {
      allowedOrgTypes: ['government_master', 'government'],
      requiredPermissions: ['canViewRegulatory'],
      requiredLayerVisibility: { regulatory: ['FULL', 'SUMMARY', 'APPROVAL'] },
    },
    submenu: {
      default: [
        { key: 'media-uploads', label: 'Media Uploads' },
        { key: 'evidence-library', label: 'Evidence Library' },
        { key: 'case-attachments', label: 'Case Attachments' },
        { key: 'missing-evidence', label: 'Missing Evidence' },
        { key: 'signed-reports', label: 'Signed Reports' },
      ],
    },
  },
  support: {
    id: 'support',
    backendRoute: '/dashboard',
    icon: 'HelpCircle',
    label: { default: 'Support' },
    purpose: 'Provide institutional support workflows and operational help channels.',
    defaultContent: 'Support queue, guidance, and service request intake for workspace users.',
    allowedActions: ['Open support ticket', 'Review support guidance'],
    visibilityScope: {
      allowedOrgTypes: '*',
      requiredPermissions: ['canView'],
    },
    submenu: {
      default: [
        { key: 'help-center', label: 'Help Center' },
        { key: 'tickets', label: 'Tickets' },
        { key: 'knowledge-base', label: 'Knowledge Base' },
        { key: 'contact-support', label: 'Contact Support' },
      ],
      byRole: {
        ministry_inspector: [
          { key: 'help', label: 'Help' },
          { key: 'technical-issues', label: 'Technical Issues' },
          { key: 'case-support', label: 'Case Support' },
        ],
      },
    },
  },
  settings: {
    id: 'settings',
    backendRoute: '/dashboard',
    icon: 'Settings',
    label: { default: 'Settings' },
    purpose: 'Manage workspace configuration and operating preferences.',
    defaultContent: 'Role-scoped configuration panel for institutional workspace settings.',
    allowedActions: ['Update workspace preferences', 'Manage notification defaults'],
    visibilityScope: {
      allowedOrgTypes: '*',
      requiredPermissions: ['canView'],
    },
    submenu: {
      default: [
        { key: 'workspace-settings', label: 'Workspace Settings' },
        { key: 'notification-rules', label: 'Notification Rules' },
        { key: 'saved-views', label: 'Saved Views' },
        { key: 'access-preferences', label: 'Access Preferences' },
        { key: 'language-region', label: 'Language & Region' },
      ],
      byRole: {
        ministry_inspector: [
          { key: 'notification-rules', label: 'Notification Rules' },
          { key: 'route-preferences', label: 'Route Preferences' },
          { key: 'language', label: 'Language' },
          { key: 'workspace-settings', label: 'Workspace Settings' },
        ],
      },
    },
  },
}

const ROLE_MENU_BLUEPRINTS: Record<MinistryRoleProfile, RoleMenuBlueprint> = {
  ministry_admin: {
    defaultLandingModule: 'national-overview',
    primary: [
      'national-overview',
      'live-map',
      'monitoring',
      'alerts-center',
      'compliance-inspections',
      'production-harvest',
    ],
    secondary: [
      'inter-agency-collaboration',
      'programs-policy',
      'reports-center',
      'support',
      'settings',
    ],
  },
  ministry_inspector: {
    defaultLandingModule: 'inspection-dashboard',
    primary: [
      'inspection-dashboard',
      'live-map',
      'compliance-cases',
      'non-conformities',
      'corrective-actions',
      'alerts-center',
    ],
    secondary: ['farms-sites', 'evidence-attachments', 'reports-center', 'support', 'settings'],
  },
}

function buildModuleHref(moduleId: string): string {
  if (moduleId === 'support') return '/dashboard/support'
  if (moduleId === 'settings') return '/dashboard/settings'
  if (moduleId === 'live-map' || moduleId === 'map') {
    return `/dashboard?module=${moduleId}&zoom=10`
  }
  return `/dashboard?module=${moduleId}`
}

function getResolvedLabel(definition: ModuleDefinition, roleProfile: MinistryRoleProfile): string {
  return definition.label.byRole?.[roleProfile] || definition.label.default
}

function getResolvedSubmenu(
  definition: ModuleDefinition,
  roleProfile: MinistryRoleProfile
): ModuleSubmenuItem[] {
  return definition.submenu.byRole?.[roleProfile] || definition.submenu.default
}

function isOrgTypeAllowed(scope: ModuleVisibilityScope, orgType: OrgType | null): boolean {
  if (scope.allowedOrgTypes === '*') return true
  if (!orgType) return false
  return scope.allowedOrgTypes.includes(orgType)
}

function hasRequiredPermissions(
  scope: ModuleVisibilityScope,
  permissions: Partial<Record<PermissionFlag, boolean>>
): boolean {
  return scope.requiredPermissions.every((permission) => Boolean(permissions[permission]))
}

function hasRequiredLayerVisibility(
  scope: ModuleVisibilityScope,
  visibilityByLayer: Partial<Record<SharedLayer, VisibilityLevel>>
): boolean {
  if (!scope.requiredLayerVisibility) return true

  return Object.entries(scope.requiredLayerVisibility).every(([layer, allowedLevels]) => {
    const current = visibilityByLayer[layer as SharedLayer] || 'NO'
    return allowedLevels.includes(current)
  })
}

function toResolvedModule(
  moduleId: string,
  roleProfile: MinistryRoleProfile
): ResolvedModuleDefinition | null {
  const definition = MODULE_REGISTRY[moduleId]
  if (!definition) return null

  return {
    id: definition.id,
    backendRoute: definition.backendRoute,
    href: buildModuleHref(definition.id),
    icon: definition.icon,
    label: getResolvedLabel(definition, roleProfile),
    purpose: definition.purpose,
    defaultContent: definition.defaultContent,
    allowedActions: definition.allowedActions,
    visibilityScope: definition.visibilityScope,
    submenu: getResolvedSubmenu(definition, roleProfile),
  }
}

function isModuleVisible(moduleId: string, context: NavigationContext): boolean {
  const definition = MODULE_REGISTRY[moduleId]
  if (!definition) return false

  return (
    isOrgTypeAllowed(definition.visibilityScope, context.orgType) &&
    hasRequiredPermissions(definition.visibilityScope, context.permissions) &&
    hasRequiredLayerVisibility(definition.visibilityScope, context.visibilityByLayer)
  )
}

export function buildRoleNavigation(
  roleProfile: MinistryRoleProfile,
  context: NavigationContext
): ResolvedRoleNavigation {
  const blueprint = ROLE_MENU_BLUEPRINTS[roleProfile]

  const primary = blueprint.primary
    .filter((moduleId) => isModuleVisible(moduleId, context))
    .map((moduleId) => toResolvedModule(moduleId, roleProfile))
    .filter((item): item is ResolvedModuleDefinition => Boolean(item))

  const secondary = blueprint.secondary
    .filter((moduleId) => isModuleVisible(moduleId, context))
    .map((moduleId) => toResolvedModule(moduleId, roleProfile))
    .filter((item): item is ResolvedModuleDefinition => Boolean(item))

  const fallbackLanding = primary[0]?.id || secondary[0]?.id || blueprint.defaultLandingModule
  const landingModuleId = primary.some((item) => item.id === blueprint.defaultLandingModule)
    ? blueprint.defaultLandingModule
    : fallbackLanding

  return {
    roleProfile,
    landingModuleId,
    landingPage: buildModuleHref(landingModuleId),
    primary,
    secondary,
  }
}
