import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

/**
 * Hash router. Hash-based so the app works under any Gateway mount path and
 * so printed QR deep links (…/#/c/K7QM2X) open straight to the scanned code.
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

export function back(fallback = "/") {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      href={"#" + to}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
      }}
      {...rest}
    />
  );
}

/** Deep link a QR label can carry so a phone camera opens the app on it. */
export function deepLink(code: string) {
  return `${window.location.origin}${window.location.pathname}#/c/${code}`;
}
