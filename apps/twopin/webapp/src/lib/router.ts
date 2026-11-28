import { useSyncExternalStore } from "react";

/**
 * Hash router. Hash-based so the app works under any Gateway mount path
 * (e.g. /apps/twopin/) and deep links survive reloads.
 */
export interface Route {
  path: string;
  segments: string[];
  query: URLSearchParams;
}

function read(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, q = ""] = raw.split("?");
  return { path, segments: path.split("/").filter(Boolean), query: new URLSearchParams(q) };
}

let current = read();
const subs = new Set<() => void>();
window.addEventListener("hashchange", () => {
  current = read();
  subs.forEach((s) => s());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => current,
  );
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = "#" + (to.startsWith("/") ? to : "/" + to);
  if (opts.replace) window.location.replace(hash);
  else window.location.hash = hash;
}

