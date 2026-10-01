import { afterEach, describe, expect, it, vi } from 'vitest'
import { invalidateShared, sharedFetch } from './shared-fetch'

function mockFetch(bodies: Array<{ status?: number; body: unknown }>) {
  let call = 0
  const fn = vi.fn(async () => {
    const next = bodies[Math.min(call, bodies.length - 1)]
    call += 1
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  invalidateShared()
  vi.unstubAllGlobals()
})

describe('sharedFetch', () => {
  it('shares concurrent requests and hands each caller a readable response', async () => {
    const fn = mockFetch([{ body: { n: 1 } }])
    const [a, b] = await Promise.all([sharedFetch('/api/x'), sharedFetch('/api/x')])
    expect(fn).toHaveBeenCalledTimes(1)
    expect(await a.json()).toEqual({ n: 1 })
    expect(await b.json()).toEqual({ n: 1 })
  })

  it('reuses a fresh answer and refetches when forced or invalidated', async () => {
    const fn = mockFetch([{ body: 1 }, { body: 2 }, { body: 3 }])
    expect(await (await sharedFetch('/api/y')).json()).toBe(1)
    expect(await (await sharedFetch('/api/y')).json()).toBe(1)
    expect(await (await sharedFetch('/api/y', { force: true })).json()).toBe(2)
    invalidateShared('/api/')
    expect(await (await sharedFetch('/api/y')).json()).toBe(3)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('never caches errors', async () => {
    const fn = mockFetch([{ status: 500, body: { error: 'x' } }, { body: { ok: true } }])
    expect((await sharedFetch('/api/z')).status).toBe(500)
    expect((await sharedFetch('/api/z')).ok).toBe(true)
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
