import { headers } from 'next/headers'

export async function getRequestOrigin(fallback = 'http://localhost:3000'): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  if (host) {
    return `${proto}://${host}`
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? fallback
}
