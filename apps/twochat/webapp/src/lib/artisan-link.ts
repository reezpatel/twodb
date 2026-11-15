/**
 * Where a collaborator's code session can be opened. The Artisan webapp lives on its own origin in development
 * (set VITE_ARTISAN_URL, e.g. https://localhost:6515) and behind the gateway otherwise.
 */
const base = (import.meta.env.VITE_ARTISAN_URL as string | undefined)?.replace(/\/+$/, "") ?? `${window.location.origin}/apps/artisan`;

export function artisanSessionUrl(sessionId: string): string {
  return `${base}/s/${sessionId}`;
}
