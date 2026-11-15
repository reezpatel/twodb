import { appOrigin } from "@twodb/twodb-shared-frontend";

/**
 * Where a collaborator's code session can be opened: Artisan's own webapp origin
 * (artisan.<root domain> in production, or VITE_ARTISAN_URL in development, e.g. https://localhost:6515).
 */
const base = (import.meta.env.VITE_ARTISAN_URL as string | undefined)?.replace(/\/+$/, "") ?? appOrigin("artisan");

export function artisanSessionUrl(sessionId: string): string {
  return `${base}/s/${sessionId}`;
}
