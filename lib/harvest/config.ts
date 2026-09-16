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
 * Harvest is demo-only until live service credentials are validated in production.
 * Set HARVEST_DEMO_MODE=false together with valid credentials to enable the live API.
 */
export function shouldUseHarvestDemo(): boolean {
  const explicitLive = process.env.HARVEST_DEMO_MODE?.trim().toLowerCase() === 'false'
  if (explicitLive && isHarvestConfigured()) return false
  return true
}

export function missingHarvestConfigPayload() {
  return {
    error: 'Harvest API credentials are not configured',
    hint:
      'Set HARVEST_API_URL, HARVEST_SERVICE_USERNAME, and HARVEST_SERVICE_PASSWORD in Vercel → Settings → Environment Variables, then redeploy. Until then, demo data is served automatically when HARVEST_DEMO_MODE is not set to false.',
    required: ['HARVEST_API_URL', 'HARVEST_SERVICE_USERNAME', 'HARVEST_SERVICE_PASSWORD'],
  }
}
