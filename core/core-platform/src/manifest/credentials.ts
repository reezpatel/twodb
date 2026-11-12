import type { AppManifestSpec } from "./types.js";

/**
 * Boot-time credential bootstrap for apps running OUTSIDE a TwoDB-managed
 * container (dev processes on the host). The app presents its registration
 * token; TwoDB returns the DB credentials it provisioned for that app —
 * the same ones a Docker install would inject as env.
 *
 * This replaces per-app DATABASE_URL vars in .env: the only secret an app
 * needs at boot is its registration token. Credentials are the app's own
 * schema-scoped role; the registry stores them encrypted.
 */
export interface GatewayCredentials {
  /** Connection string scoped to the app's schema + role, reachable from where the app runs. */
  connectionString: string;
  schema: string;
  role: string;
  /** Stable per-app data key (same one Docker installs inject as TWODB_DATA_KEY). */
  dataKey?: string;
}

export interface FetchCredentialsOptions {
  gatewayUrl: string;
  registrationToken: string;
  slug: string;
}

/** Retryable like registerWithGateway: turbo boots everything in parallel. */
export async function fetchDatabaseCredentials(
  options: FetchCredentialsOptions,
  { attempts = 30, intervalMs = 2000 }: { attempts?: number; intervalMs?: number } = {},
): Promise<GatewayCredentials> {
  const url = new URL("/registry/credentials", options.gatewayUrl);
  let lastError: unknown = new Error("never attempted");

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: options.slug, registrationToken: options.registrationToken }),
      });
      if (res.ok) {
        const body = (await res.json()) as GatewayCredentials;
        return body;
      }
      // The gateway answered — a real rejection. Retrying won't fix it.
      throw new Error(
        `fetchDatabaseCredentials(${options.slug}) failed: ${res.status} ${await res.text()}`,
      );
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.message.includes("failed:")) throw err; // HTTP-level failure
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw lastError;
}
