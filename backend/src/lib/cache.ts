// Cache in-memory sederhana dengan TTL untuk data yang sering dibaca (setting, station, knowledge AI).
type Entry = { value: unknown; expiresAt: number };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export const cached = async <T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> => {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  // Cegah banyak request bersamaan memanggil loader yang sama.
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = loader()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
};

/** Hapus cache yang key-nya diawali salah satu prefix. */
export const invalidate = (...prefixes: string[]) => {
  for (const key of store.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) store.delete(key);
  }
};
