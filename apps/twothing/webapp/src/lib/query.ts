import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * A ~60-line stale-while-revalidate cache: enough for a personal app, no
 * react-query dependency. Entries are keyed by string; `invalidate(prefix)`
 * refetches every mounted query whose key starts with it.
 */
interface Entry {
  data?: unknown;
  error?: unknown;
  loading: boolean;
  promise?: Promise<unknown>;
  fetcher?: () => Promise<unknown>;
}

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

function run(key: string) {
  const e = cache.get(key);
  if (!e?.fetcher) return;
  e.loading = true;
  const p = e.fetcher().then(
    (data) => {
      if (e.promise === p) Object.assign(e, { data, error: undefined, loading: false });
      emit();
    },
    (error) => {
      if (e.promise === p) Object.assign(e, { error, loading: false });
      emit();
    },
  );
  e.promise = p;
  emit();
}

export function invalidate(...prefixes: string[]) {
  for (const key of cache.keys()) if (prefixes.some((p) => key.startsWith(p))) run(key);
}

export function useQuery<T>(key: string | null, fetcher: () => Promise<T>) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  useSyncExternalStore(
    useCallback((cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    }, []),
    () => version,
  );
  useEffect(() => {
    if (!key) return;
    let e = cache.get(key);
    if (!e) {
      e = { loading: true };
      cache.set(key, e);
    }
    e.fetcher = () => fetcherRef.current();
    run(key);
  }, [key]);
  const e = key ? cache.get(key) : undefined;
  return {
    data: e?.data as T | undefined,
    error: e?.error,
    loading: !e || (e.loading && e.data === undefined),
    refreshing: !!e?.loading,
    refetch: () => key && run(key),
  };
}

/** Optimistically patch a cached value (e.g. a quantity bump) before the server answers. */
export function mutateCache<T>(key: string, fn: (prev: T) => T) {
  const e = cache.get(key);
  if (e?.data !== undefined) {
    e.data = fn(e.data as T);
    emit();
  }
}
