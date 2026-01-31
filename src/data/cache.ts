export type CachedData<T> = {
  data: T;
  timestamp: number;
  stale: boolean;
};

const cache = new Map<string, { value: unknown; timestamp: number }>();

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number
): Promise<CachedData<T>> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.timestamp <= ttlMs) {
    return {
      data: cached.value as T,
      timestamp: cached.timestamp,
      stale: false
    };
  }

  const data = await fetcher();
  cache.set(key, { value: data, timestamp: now });
  return {
    data,
    timestamp: now,
    stale: false
  };
}

export function markStale<T>(cached: CachedData<T>, ttlMs: number): CachedData<T> {
  const now = Date.now();
  const stale = now - cached.timestamp > ttlMs;
  return { ...cached, stale };
}

export function clearCache(): void {
  cache.clear();
}
