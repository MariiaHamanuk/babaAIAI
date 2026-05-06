// In-memory cache with KV-shaped interface.
// Always operational — site navigation and the snapshot cache rely on it.
// DISABLE_CACHE=1 only affects the LLM-answer caches, gated inside lib/ai/*.

type Entry<T> = { value: T; expiresAt: number | null };

const store = new Map<string, Entry<unknown>>();

export const cache = {
  async get<T>(key: string): Promise<T | undefined> {
    const e = store.get(key) as Entry<T> | undefined;
    if (!e) return undefined;
    if (e.expiresAt !== null && e.expiresAt < Date.now()) {
      store.delete(key);
      return undefined;
    }
    return e.value;
  },
  async set<T>(key: string, value: T, ttlSeconds: number | null): Promise<void> {
    store.set(key, {
      value,
      expiresAt: ttlSeconds === null ? null : Date.now() + ttlSeconds * 1000,
    });
  },
  async delete(key: string): Promise<void> {
    store.delete(key);
  },
  async withCache<T>(
    key: string,
    ttlSeconds: number | null,
    fn: () => Promise<T>,
  ): Promise<T> {
    const hit = await cache.get<T>(key);
    if (hit !== undefined) return hit;
    const value = await fn();
    await cache.set(key, value, ttlSeconds);
    return value;
  },
};
