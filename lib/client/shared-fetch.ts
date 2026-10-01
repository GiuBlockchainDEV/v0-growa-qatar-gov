/*
 * Shared GET cache for the browser.
 *
 * One dashboard screen used to download the same endpoints up to three times:
 * the map, the workspace beside it and the header search each fetched
 * `custom-map-points`, `custom-point-polygons`, `farm-crop-insights` and
 * `farms` on their own, and `/api/watchtower/summary` (the most expensive
 * route: it rebuilds the Harvest catalog) was requested by the workspace and
 * by the embedded map.
 *
 * `sharedFetch(url)` is a drop-in for `fetch(url, { cache: 'no-store' })` on
 * GET requests:
 *   · concurrent calls for the same URL share one request;
 *   · a successful answer is reused for `ttlMs` (30 s by default);
 *   · every caller gets its own fresh `Response`, so `.json()` can be read
 *     by each of them;
 *   · errors are never cached.
 *
 * After a write, call `invalidateShared(prefix)` so the next read goes to
 * the network. `force: true` skips the cache (the "Refresh" buttons).
 */

type Snapshot = { status: number; statusText: string; headers: [string, string][]; body: string }
type Entry = { at: number; snapshot?: Snapshot; pending?: Promise<Snapshot> }

const DEFAULT_TTL_MS = 30_000
const MAX_ENTRIES = 64
const cache = new Map<string, Entry>()

function toResponse(snapshot: Snapshot): Response {
  return new Response(snapshot.body, {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers: snapshot.headers,
  })
}

async function capture(url: string, init?: RequestInit): Promise<Snapshot> {
  const response = await fetch(url, { ...init, method: 'GET', cache: 'no-store' })
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Array.from(response.headers.entries()),
    body: await response.text(),
  }
}

function prune() {
  if (cache.size <= MAX_ENTRIES) return
  const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)
  for (const [key] of oldest.slice(0, cache.size - MAX_ENTRIES)) cache.delete(key)
}

export async function sharedFetch(
  url: string,
  options: { ttlMs?: number; force?: boolean; signal?: AbortSignal } = {}
): Promise<Response> {
  const { ttlMs = DEFAULT_TTL_MS, force = false, signal } = options
  const now = Date.now()
  const entry = cache.get(url)

  if (!force && entry?.snapshot && now - entry.at < ttlMs) return toResponse(entry.snapshot)
  if (!force && entry?.pending) return toResponse(await entry.pending)

  const pending = capture(url, { signal })
  cache.set(url, { at: now, snapshot: entry?.snapshot, pending })
  try {
    const snapshot = await pending
    if (snapshot.status >= 200 && snapshot.status < 300) {
      cache.set(url, { at: Date.now(), snapshot })
      prune()
    } else {
      cache.delete(url)
    }
    return toResponse(snapshot)
  } catch (error) {
    cache.delete(url)
    throw error
  }
}

/** Drop cached answers whose URL starts with `prefix` (all of them without one). */
export function invalidateShared(prefix = '') {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}
