import type { AppManifestSpec } from "./types.js";
import { toEndpointJson } from "./generate.js";

export interface RegisterWithGatewayOptions {
  gatewayUrl: string;
  /**
   * The unique, per-app registration token TwoDB generated for this exact
   * app at install time (`TWODB_PROVISION_TOKEN` env var, injected by the
   * Docker orchestrator — or obtained by hand via
   * `POST /orchestrator/apps/:slug/issue-token` for local dev). There is no
   * shared secret anymore: a stolen token only ever impersonates the one
   * app it was issued for, and TwoDB rejects a token presented by the wrong
   * slug.
   */
  registrationToken: string;
  httpUrl: string;
  socketPath?: string;
}

/**
 * Every app calls this once on boot to register itself as reachable with
 * TwoDB (the app itself was already installed/provisioned by TwoDB before
 * this ever runs — see ECOSYSTEM.md "How other apps plug in"). Safe to call
 * on every restart — TwoDB upserts by slug, as long as the token still
 * matches what it issued.
 *
 * Retries with backoff until the gateway is reachable: turbo starts every
 * app in parallel, so this usually runs before TwoDB is listening on its
 * port. A network-level failure (gateway not up yet) is waited out; an HTTP
 * error response (bad token etc.) still fails fast — retrying won't fix it.
 */
export async function registerWithGateway(
  manifest: AppManifestSpec,
  options: RegisterWithGatewayOptions,
  { attempts = 30, intervalMs = 2000 }: { attempts?: number; intervalMs?: number } = {},
): Promise<void> {
  const endpointJson = toEndpointJson(manifest);
  const url = new URL("/registry/register", options.gatewayUrl);
  let lastError: unknown = new Error("never attempted");

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: manifest.slug,
          registrationToken: options.registrationToken,
          httpUrl: options.httpUrl,
          socketPath: options.socketPath,
          manifest: endpointJson,
        }),
      });
      if (res.ok) return;
      // The gateway answered — a real rejection (wrong token, etc.).
      // Retrying won't change the answer.
      throw new Error(`registerWithGateway(${manifest.slug}) failed: ${res.status} ${await res.text()}`);
    } catch (err) {
      lastError = err;
      // Only network-level failures are retryable — they mean the gateway
      // isn't listening yet (turbo started us in parallel). Undici wraps
      // ECONNREFUSED etc. as TypeError("fetch failed") with a `cause`;
      // anything else (our own HTTP-status throw, a real fetch bug) fails
      // fast because retrying won't change the answer.
      const isNetworkFailure =
        err instanceof TypeError && /fetch failed/.test(err.message ?? "");
      if (!isNetworkFailure) throw err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `registerWithGateway(${manifest.slug}) could not reach ${options.gatewayUrl} after ${attempts} attempts: ${String(lastError)}`,
  );
}
