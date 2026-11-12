/**
 * Does an app's cached endpoint.json declare `subPath` as a WebSocket path?
 * Declared patterns use `:param` segments (e.g. "/boards/:id/ws").
 */
export function isDeclaredWebsocketPath(manifestJson: string, subPath: string): boolean {
  if (!manifestJson) return false;
  let patterns: unknown;
  try {
    patterns = (JSON.parse(manifestJson) as { websocketPaths?: unknown }).websocketPaths;
  } catch {
    return false;
  }
  if (!Array.isArray(patterns)) return false;
  const segs = subPath.split("/").filter(Boolean);
  return patterns.some((p) => {
    if (typeof p !== "string") return false;
    const ps = p.split("/").filter(Boolean);
    return ps.length === segs.length && ps.every((x, i) => x.startsWith(":") || x === segs[i]);
  });
}

/**
 * `internal` path segments (`/internal/...`, `/apps/<slug>/internal/...`) are
 * the human-only surface: reachable with an interactive user session (UI /
 * bearer session token) and NEVER with a machine credential (workspace API
 * key, app token). Enforced at the gateway edge for HTTP and WS upgrades.
 */
export function isInternalPath(pathname: string): boolean {
  return /(^|\/)internal(\/|$)/.test(pathname.split("?")[0]);
}
