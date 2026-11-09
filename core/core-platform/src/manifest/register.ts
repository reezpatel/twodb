import type { AppManifestSpec } from "./types.js";
import { toEndpointJson } from "./generate.js";

export interface RegisterWithGatewayOptions {
  gatewayUrl: string;
  provisionToken: string;
  httpUrl: string;
  socketPath?: string;
  hostId: string;
}

/**
 * Every app calls this once on boot to self-register with TwoDB (per the
 * "apps register themselves into TwoAdmin" decision). Safe to call on every
 * restart — TwoDB upserts by slug.
 */
export async function registerWithGateway(
  manifest: AppManifestSpec,
  options: RegisterWithGatewayOptions,
): Promise<void> {
  const endpointJson = toEndpointJson(manifest);
  const res = await fetch(new URL("/registry/register", options.gatewayUrl), {
    method: "POST",
    headers: { "content-type": "application/json", "x-provision-token": options.provisionToken },
    body: JSON.stringify({
      slug: manifest.slug,
      name: manifest.name,
      version: manifest.version,
      shape: manifest.shape,
      basePath: manifest.basePath,
      httpUrl: options.httpUrl,
      socketPath: options.socketPath,
      hostId: options.hostId,
      capabilities: manifest.capabilities,
      manifest: endpointJson,
    }),
  });
  if (!res.ok) {
    throw new Error(`registerWithGateway(${manifest.slug}) failed: ${res.status} ${await res.text()}`);
  }
}
