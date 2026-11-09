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
 */
export async function registerWithGateway(
  manifest: AppManifestSpec,
  options: RegisterWithGatewayOptions,
): Promise<void> {
  const endpointJson = toEndpointJson(manifest);
  const res = await fetch(new URL("/registry/register", options.gatewayUrl), {
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
  if (!res.ok) {
    throw new Error(`registerWithGateway(${manifest.slug}) failed: ${res.status} ${await res.text()}`);
  }
}
