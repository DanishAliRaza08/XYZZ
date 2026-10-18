// A small in-memory cache for data every shop page needs (catalogue, menu, settings, seasonal events).
// Without it each page view re-reads the whole catalogue from the database; with it the database is
// read at most once a minute. Admin saves and paid orders clear it straight away (invalidateStoreCache),
// so changes still show immediately. One copy per server process — fine for a single Node.js server.

type Entry = { value: Promise<unknown>; expires: number };

const globalStore = globalThis as unknown as { __frStoreCache?: Map<string, Entry> };
const store = (globalStore.__frStoreCache ??= new Map());

export const STORE_CACHE_SECONDS = 60;

/** Returns the cached value for key, loading it (once, even with many visitors at the same moment) when missing or stale. */
export function cached<T>(key: string, load: () => Promise<T>, ttlSeconds = STORE_CACHE_SECONDS): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { value, expires: now + ttlSeconds * 1000 });
  // A failed load (e.g. database briefly unreachable) must not be remembered.
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  return value;
}

/** Forget everything, so the next page view reads fresh data (after admin changes, paid orders, …). */
export function invalidateStoreCache() {
  store.clear();
}
