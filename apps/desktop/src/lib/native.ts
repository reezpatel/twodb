/**
 * Native (bundled) builds — Tauri desktop/Android/iOS ship the UI inside the
 * app and talk to a user-chosen twodb server cross-origin. The web build is
 * served by that server itself, so everything below is a no-op there:
 * relative `/api` paths and cookie auth keep working unchanged.
 *
 * Native auth uses a bearer token (WebKit blocks cross-site cookies): the
 * server's better-auth `bearer` plugin returns it in `set-auth-token` on
 * sign-in; we keep it in localStorage and send it as `Authorization`. URLs
 * that can't carry headers (WebSockets, <img>/<a>/<audio>) get it as
 * `?auth_token=`.
 */

const SERVER_KEY = "twodb.serverUrl";
const TOKEN_KEY = "twodb.authToken";
const FORCE_NATIVE_KEY = "twodb.forceNative";

/** Running inside the Tauri shell (any platform). Dev override: set
 *  localStorage `twodb.forceNative=1` to exercise native mode in a browser. */
export const isNative: boolean =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || (import.meta.env.DEV && localStorage.getItem(FORCE_NATIVE_KEY) === "1"));

/** Normalizes user input ("app.twodb.io", "https://x/") → "https://x". */
export function normalizeServerUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getServerUrl(): string | null {
  return isNative ? localStorage.getItem(SERVER_KEY) : null;
}

/** Switching servers drops the old session token; callers reload the app so
 *  the auth client and caches start fresh against the new server. */
export function setServerUrl(url: string | null) {
  if (url) localStorage.setItem(SERVER_KEY, url);
  else localStorage.removeItem(SERVER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken(): string | null {
  return isNative ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** `/api/x` → absolute server URL in native builds; unchanged on the web. */
export function apiUrl(path: string): string {
  const server = getServerUrl();
  return server && path.startsWith("/") ? `${server}${path}` : path;
}

/** Auth headers for fetch() in native builds (empty on the web). */
export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

function withToken(url: string): string {
  const token = getAuthToken();
  if (!token) return url;
  return `${url}${url.includes("?") ? "&" : "?"}auth_token=${encodeURIComponent(token)}`;
}

/** URL for <img src>, <a href>, <audio src> pointing at the API. */
export function assetUrl(path: string): string;
export function assetUrl(path: string | null | undefined): string | null;
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return isNative ? withToken(apiUrl(path)) : path;
}

/** ws(s):// URL for an API WebSocket path. */
export function wsUrl(path: string): string {
  const server = getServerUrl();
  const base = server ? new URL(server) : new URL(location.href);
  const proto = base.protocol === "https:" ? "wss" : "ws";
  return withToken(`${proto}://${base.host}${path}`);
}

/** fetch() against the API — absolute URL + bearer in native builds, plain
 *  same-origin cookie fetch on the web. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), {
    credentials: "include",
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
}
