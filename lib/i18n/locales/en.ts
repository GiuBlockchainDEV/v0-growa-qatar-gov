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

  // App
  'app.name': 'Growa Qatar',
  'app.tagline': 'Sovereign Agricultural Operations Platform',

  // Auth (placeholders for Phase 2)
  'auth.signIn': 'Sign In',
  'auth.signOut': 'Sign Out',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.forgotPassword': 'Forgot Password?',
  'auth.resetPassword': 'Reset Password',

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
}

export default en
