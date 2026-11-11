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
