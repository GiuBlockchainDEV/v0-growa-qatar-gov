const DEFAULT_HARVEST_API_URL = 'https://harvest.growa.ai'

export function getHarvestApiBaseUrl(): string {
  return (process.env.HARVEST_API_URL || DEFAULT_HARVEST_API_URL).replace(/\/+$/, '')
}

export function getHarvestCredentials() {
  const username = process.env.HARVEST_SERVICE_USERNAME?.trim() || ''
  const password = process.env.HARVEST_SERVICE_PASSWORD?.trim() || ''
  return { username, password }
}

export function isHarvestConfigured(): boolean {
  const { username, password } = getHarvestCredentials()
  return Boolean(username && password)
}

/**
 * Demo data is used when:
 * - HARVEST_DEMO_MODE=true, or
 * - credentials are missing (auto-fallback so the workspace does not 503)
 *
 * Set HARVEST_DEMO_MODE=false together with valid credentials to force live API only.
 */
export function shouldUseHarvestDemo(): boolean {
  const explicitDemo = process.env.HARVEST_DEMO_MODE?.trim().toLowerCase()
  if (explicitDemo === 'true') return true
  if (explicitDemo === 'false' && isHarvestConfigured()) return false
  if (!isHarvestConfigured()) return true
  return false
}

export function missingHarvestConfigPayload() {
  return {
    error: 'Harvest API credentials are not configured',
    hint:
      'Set HARVEST_API_URL, HARVEST_SERVICE_USERNAME, and HARVEST_SERVICE_PASSWORD in Vercel → Settings → Environment Variables, then redeploy. Until then, demo data is served automatically when HARVEST_DEMO_MODE is not set to false.',
    required: ['HARVEST_API_URL', 'HARVEST_SERVICE_USERNAME', 'HARVEST_SERVICE_PASSWORD'],
  }
}
