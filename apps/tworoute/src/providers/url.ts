/** Joins a provider base URL (which may itself carry a path, e.g. "https://api.openai.com/v1") with an endpoint path — `new URL()` can't do this, it would drop the base path. */
export function joinUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, "") + path;
}
