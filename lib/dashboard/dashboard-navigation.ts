export function resolveDashboardHref(current: URLSearchParams, target: string): string {
  const trimmed = target.trim()
  if (!trimmed) return '/dashboard?module=watchtower'

  if (trimmed.startsWith('/dashboard/') && !trimmed.startsWith('/dashboard?')) {
    return trimmed
  }

  const query = trimmed.includes('?') ? trimmed.split('?')[1] : trimmed
  const params = new URLSearchParams(query)

  if (!params.get('module')) {
    params.set('module', current.get('module') || 'watchtower')
  }

  return `/dashboard?${params.toString()}`
}
