import type { AppManifestSpec } from "./types.js";
import { toEndpointJson } from "./generate.js";

export interface ManifestServeOptions {
  /** The per-app registration token TwoDB injected at install time (`TWODB_PROVISION_TOKEN`). */
  registrationToken: string;
  /** The URL the app wants the gateway to proxy to (`HTTP_URL`). */
  httpUrl: string;
}

export interface ManifestServeResult {
  status: number;
  body: unknown;
}

export const INTERNAL_MANIFEST_PATH = "/internal/manifest";
export const REGISTRATION_TOKEN_HEADER = "x-registration-token";

/**
 * Framework-agnostic handler for `GET /internal/manifest` — the
 * pull-registration counterpart to `registerWithGateway()`'s push. TwoDB's
 * Docker orchestrator polls this route on a freshly-started container's
 * published host port and completes registration itself; the token check
 * proves the responder is the exact app TwoDB installed (only it knows the
 * token injected into its env), not a squatter on the port.
 *
 * Why both paths exist: containers on a firewalled host can't reach
 * TwoDB at all (container→host INPUT is dropped), so push registration is
 * impossible there — but the gateway can always reach the container's
 * published port. Apps running directly on the host (dev mode) push;
 * containerized apps get pulled. Both end in the same
 * `registry.completeRegistration()`.
 *
 * Wire it into whatever HTTP framework the app uses, e.g. Fastify:
 *
 *   app.get(INTERNAL_MANIFEST_PATH, async (req, reply) => {
 *     const res = handleManifestRequest(manifest, opts, req.headers[REGISTRATION_TOKEN_HEADER]);
 *     return reply.code(res.status).send(res.body);
 *   });
 */
export function handleManifestRequest(
  manifest: AppManifestSpec,
  options: ManifestServeOptions,
  presentedToken: string | string[] | undefined,
): ManifestServeResult {
  if (presentedToken !== options.registrationToken) {
    return { status: 401, body: { error: "invalid registration token" } };
  }
  return {
    status: 200,
    body: { slug: manifest.slug, httpUrl: options.httpUrl, manifest: toEndpointJson(manifest) },
  };
}
