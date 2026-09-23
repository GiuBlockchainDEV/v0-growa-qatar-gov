/**
 * Growa Qatar - English Translations
 * Step 0.4: i18n baseline
 * 
 * English is the default locale.
 * Keys are organized by feature/domain.
 */

const en: Record<string, string> = {
  // Common
  'common.loading': 'Loading...',
  'common.error': 'An error occurred',
  'common.retry': 'Retry',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.view': 'View',
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.clear': 'Clear',
  'common.close': 'Close',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.previous': 'Previous',
  'common.submit': 'Submit',
  'common.or': 'Or',

  // App
  'app.name': 'Growa Qatar',
  'app.tagline': 'Sovereign Agricultural Operations Platform',

  // Auth - Sign In
  'auth.sign_in': 'Sign In',
  'auth.sign_in_subtitle': 'Agricultural Operations Platform for Qatar',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.forgot_password': 'Forgot Password?',
  'auth.have_invitation': 'I have an invitation code',
  'auth.no_account_contact_admin': 'Don\'t have an account? Contact your organization administrator',
  'auth.failed_attempts': 'Failed Attempts',

  // Auth - General
  'auth.signOut': 'Sign Out',
  'auth.resetPassword': 'Reset Password',

  // Watchtower
  'watchtower.title': 'Qatar Agricultural Watchtower',
  'watchtower.subtitle': 'National situational awareness & operational intelligence',
  'watchtower.loading': 'Loading national watchtower...',
  'watchtower.refresh': 'Refresh',
  'watchtower.last_refresh': 'Last refresh',
  'watchtower.data_coverage': 'Data coverage',
  'watchtower.demo_mode': 'Demo data active',
  'watchtower.partial_degradation': 'Partial degradation',
  'watchtower.priority_signals': 'Priority signals',
  'watchtower.no_signals': 'No priority signals in current window',
  'watchtower.what_changed': 'What changed',
  'watchtower.outlook': 'Outlook',
  'watchtower.data_health': 'Data confidence',
  'watchtower.ai_briefing': 'Growa AI briefing',
  'watchtower.ai_ready': 'AI briefing ready',
  'watchtower.ai_available': 'AI available',
  'watchtower.national_map': 'National situation map',
  'watchtower.national_estimations': 'National production estimations',
  'watchtower.layers_active': 'layers active',
  'watchtower.alert_created': 'Alert created successfully',
  'watchtower.upcoming_module': 'Module upcoming',
  'watchtower.upcoming_description': 'This module is structured in navigation but backend integration is not yet complete. Use the National Watchtower and linked intelligence modules for live data.',

  // Operational context
  'context.active': 'Active context',
  'context.back_to_watchtower': 'Back to Watchtower',
  'context.clear': 'Clear',

  // Alerts
  'alerts.title': 'Alerts Center',
  'alerts.subtitle': 'Operational alert lifecycle from Watchtower intelligence signals',
  'alerts.empty': 'No alerts in the current filter. Create alerts from Watchtower priority signals.',
  'alerts.from_watchtower': 'Open National Watchtower',
  'alerts.migration_required': 'Alerts persistence requires database migration 00028_operational_alerts. Alert creation from Watchtower will be unavailable until applied.',
  'alerts.workflow_note': 'Signals from the Watchtower can be promoted to alerts. Alerts follow: new → acknowledged → investigating → action required → monitoring → resolved.',

  // Module workspace
  'module.investigate_via': 'Investigate via connected modules',

  // Navigation sections
  'nav.area.watchtower': 'Watchtower',
  'nav.area.operations': 'Operations',
  'nav.area.intelligence': 'Intelligence',
  'nav.area.food_security': 'Food Security',
  'nav.area.risk_response': 'Risk & Response',
  'nav.area.governance': 'Governance',
  'nav.area.ai_operations': 'AI Operations',
  'nav.area.platform': 'Platform',

  'nav.section.watchtower': 'Watchtower',
  'nav.section.operations': 'Operations',
  'nav.section.intelligence': 'Intelligence',
  'nav.section.food_security': 'Food Security',
  'nav.section.risk_compliance': 'Risk & Compliance',
  'nav.section.collaboration': 'Collaboration',
  'nav.section.feeds': 'Intelligence Feeds',
  'nav.section.platform': 'Platform',

  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.map': 'Operations Map',
  'nav.alerts': 'Alerts',
  'nav.inspections': 'Inspections',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  'nav.admin': 'Administration',

  // Status
  'status.healthy': 'Healthy',
  'status.warning': 'Warning',
  'status.critical': 'Critical',
  'status.offline': 'Offline',
  'status.pending': 'Pending',
  'status.active': 'Active',
  'status.suspended': 'Suspended',
  'status.revoked': 'Revoked',

  // Organizations
  'org.ministry': 'Ministry',
  'org.sovereign': 'Sovereign Entity',
  'org.stateOperator': 'State Operator',
  'org.financial': 'Financial Institution',
  'org.research': 'Research Entity',
  'org.external': 'External Operator',

  // Direction
  'direction.ltr': 'Left to Right',
  'direction.rtl': 'Right to Left',
  'language.english': 'English',
  'language.arabic': 'Arabic',
  'language.switch': 'Switch Language',

  // Operations - Farms
  'operations.farms': 'Farms',
  'operations.farms_description': 'Manage all farms in your organization',
  'operations.add_farm': 'Add Farm',
  'operations.create_farm': 'Add New Farm',
  'operations.farm_name_en': 'Farm Name (English)',
  'operations.farm_name_ar': 'Farm Name (Arabic)',
  'operations.farm_location': 'Location',
  'operations.farm_type': 'Farm Type',
  'operations.farm_size': 'Size (Hectares)',
  'operations.farm_status': 'Status',
  'operations.farm_type_crop': 'Crop',
  'operations.farm_type_livestock': 'Livestock',
  'operations.farm_type_aquaculture': 'Aquaculture',
  'operations.status_active': 'Active',
  'operations.status_inactive': 'Inactive',
  'operations.status_maintenance': 'Maintenance',
  'operations.no_farms': 'No farms yet',
  'operations.create_first_farm': 'Create your first farm',

  // Operations - Cycles
  'operations.cycles': 'Production Cycles',
  'operations.cycles_description': 'Track growing and breeding cycles',

  // Operations - Inventory
  'operations.inventory': 'Inventory',
  'operations.inventory_description': 'Manage inputs and resources',

  // Operations - General
  'operations.create': 'Create',
  'operations.edit': 'Edit',
  'operations.delete': 'Delete',
  'operations.actions': 'Actions',
  'operations.save': 'Save',
  'operations.cancel': 'Cancel',
  'operations.deleting': 'Deleting...',
  'operations.confirm_delete': 'Are you sure?',
}

export default en
