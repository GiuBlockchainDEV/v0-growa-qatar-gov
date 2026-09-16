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

export function missingHarvestConfigPayload() {
  return {
    error: 'Harvest API credentials are not configured',
    hint:
      'Set HARVEST_API_URL, HARVEST_SERVICE_USERNAME, and HARVEST_SERVICE_PASSWORD in the server environment and redeploy.',
  }
}
