/**
 * Growa Qatar - Deployment Configuration
 * Step 0.3: Environment strategy
 * 
 * This module provides deployment-aware configuration that respects
 * the environment isolation strategy defined in the blueprint.
 */

export type DeploymentEnv = 'local' | 'preview' | 'staging' | 'production'

export type CountryCode = 'QA' // Future: 'SA' | 'AE' | 'OM' | 'KW' | 'BH'

export interface DeploymentConfig {
  env: DeploymentEnv
  country: {
    code: CountryCode
    name: string
  }
  supabase: {
    url: string
    anonKey: string
  }
  i18n: {
    defaultLocale: string
    supportedLocales: string[]
  }
  features: {
    mfa: boolean
    sso: boolean
    realtime: boolean
  }
}

/**
 * Get the current deployment configuration from environment variables.
 * This function validates that required configuration is present.
 */
export function getDeploymentConfig(): DeploymentConfig {
  const env = (process.env.NEXT_PUBLIC_DEPLOYMENT_ENV || 'local') as DeploymentEnv
  
  // Validate environment value
  if (!['local', 'preview', 'staging', 'production'].includes(env)) {
    throw new Error(`Invalid NEXT_PUBLIC_DEPLOYMENT_ENV: ${env}`)
  }

  return {
    env,
    country: {
      code: (process.env.NEXT_PUBLIC_COUNTRY_CODE || 'QA') as CountryCode,
      name: process.env.NEXT_PUBLIC_COUNTRY_NAME || 'Qatar',
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    },
    i18n: {
      defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'en',
      supportedLocales: (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES || 'en,ar').split(','),
    },
    features: {
      mfa: process.env.NEXT_PUBLIC_FEATURE_MFA === 'true',
      sso: process.env.NEXT_PUBLIC_FEATURE_SSO === 'true',
      realtime: process.env.NEXT_PUBLIC_FEATURE_REALTIME === 'true',
    },
  }
}

/**
 * Check if the current environment is production.
 * Used for safety checks before destructive operations.
 */
export function isProduction(): boolean {
  return process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'production'
}

/**
 * Check if the current environment allows development features.
 */
export function isDevelopment(): boolean {
  const env = process.env.NEXT_PUBLIC_DEPLOYMENT_ENV
  return env === 'local' || env === 'preview'
}

/**
 * Validate that Supabase configuration is present.
 * Call this before initializing Supabase clients.
 */
export function validateSupabaseConfig(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    )
  }
}
