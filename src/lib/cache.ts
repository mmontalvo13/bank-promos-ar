type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  inFlight?: Promise<T>;
};

type CacheStore = Map<string, CacheEntry<unknown>>;

function store(): CacheStore {
  const g = globalThis as unknown as { __BANK_PROMOS_CACHE__?: CacheStore };
  if (!g.__BANK_PROMOS_CACHE__) g.__BANK_PROMOS_CACHE__ = new Map();
  return g.__BANK_PROMOS_CACHE__;
}

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const s = store();
  const existing = s.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.value !== undefined && existing.expiresAt > now) return existing.value;
  if (existing?.inFlight) return existing.inFlight;

  const entry: CacheEntry<T> = existing ?? { expiresAt: 0 };
  const p = fn()
    .then((value) => {
      entry.value = value;
      entry.expiresAt = Date.now() + ttlMs;
      entry.inFlight = undefined;
      s.set(key, entry as CacheEntry<unknown>);
      return value;
    })
    .catch((err) => {
      entry.inFlight = undefined;
      s.set(key, entry as CacheEntry<unknown>);
      throw err;
    });

  entry.inFlight = p;
  s.set(key, entry as CacheEntry<unknown>);
  return p;
}

/**
 * Stale-while-revalidate cache.
 * - If value is fresh: return it.
 * - If value is stale but present: return it immediately and refresh in background.
 * - If value missing: return fallback immediately and refresh in background.
 */
export async function cachedSWR<T>(opts: {
  key: string;
  ttlMs: number;
  fn: () => Promise<T>;
  fallback: T;
}): Promise<T> {
  const { key, ttlMs, fn, fallback } = opts;
  const now = Date.now();
  const s = store();
  const existing = s.get(key) as CacheEntry<T> | undefined;

  if (existing?.value !== undefined && existing.expiresAt > now) return existing.value;

  // Kick off refresh if not already running.
  if (!existing?.inFlight) {
    const entry: CacheEntry<T> = existing ?? { expiresAt: 0 };
    const p = fn()
      .then((value) => {
        entry.value = value;
        entry.expiresAt = Date.now() + ttlMs;
        entry.inFlight = undefined;
        s.set(key, entry as CacheEntry<unknown>);
        return value;
      })
      .catch(() => {
        entry.inFlight = undefined;
        s.set(key, entry as CacheEntry<unknown>);
        return entry.value ?? fallback;
      });
    entry.inFlight = p;
    s.set(key, entry as CacheEntry<unknown>);
  }

  return existing?.value ?? fallback;
}

