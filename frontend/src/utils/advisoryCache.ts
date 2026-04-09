const CACHE_PREFIX = 'kisaannavi_advisory_cache:'
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7

interface CachedEntry<T> {
  value: T
  savedAt: string
  expiresAt: string
}

function fullKey(key: string): string {
  return `${CACHE_PREFIX}${key}`
}

export function getCacheKey(feature: string, params: Record<string, unknown>): string {
  const normalized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => [name, String(value)])

  return `${feature}:${JSON.stringify(normalized)}`
}

export function readCachedValue<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(fullKey(key))
    if (!raw) return null
    const entry = JSON.parse(raw) as CachedEntry<T>
    if (new Date(entry.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(fullKey(key))
      return null
    }
    return entry.value
  } catch {
    return null
  }
}

export function writeCachedValue<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  try {
    const now = Date.now()
    const entry: CachedEntry<T> = {
      value,
      savedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    }
    localStorage.setItem(fullKey(key), JSON.stringify(entry))
  } catch {
    // Ignore cache failures
  }
}

export function withOfflineCache<T>(options: {
  cacheKey: string
  loader: () => Promise<T>
  ttlMs?: number
}): Promise<{ data: T; fromCache: boolean }> {
  const cached = readCachedValue<T>(options.cacheKey)

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (cached) {
      return Promise.resolve({ data: cached, fromCache: true })
    }
    return options.loader().then((data) => ({ data, fromCache: false }))
  }

  return options.loader()
    .then((data) => {
      writeCachedValue(options.cacheKey, data, options.ttlMs)
      return { data, fromCache: false }
    })
    .catch((error) => {
      if (cached) {
        return { data: cached, fromCache: true }
      }
      throw error
    })
}
