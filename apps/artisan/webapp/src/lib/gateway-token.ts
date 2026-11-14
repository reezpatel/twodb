/** Per-login gateway token, held in memory only (never persisted).
 *
 * On first use (or after expiry) we exchange the browser's better-auth
 * cookie session — same-origin, credentials:include — for a gateway Bearer
 * token via the control plane's /auth/gateway-token. That token is what the
 * gateway validates uniformly for every app, so all artisan API calls (and
 * WS upgrades, via ?access_token=) send it as Authorization: Bearer.
 */

let cached: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  const res = await fetch("/auth/gateway-token", { credentials: "include" });
  if (!res.ok) {
    cached = null;
    throw new Error(`gateway-token ${res.status}`);
  }
  const body = (await res.json()) as { accessToken: string; expiresAt: string };
  const expiresAt = new Date(body.expiresAt).getTime();
  // Refresh a minute early so a long-lived page never sends a stale token.
  cached = { token: body.accessToken, expiresAt: expiresAt - 60_000 };
  return body.accessToken;
}

/** Returns a valid in-memory gateway token, fetching/refreshing as needed. */
export async function gatewayToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  if (!inflight) {
    inflight = fetchToken().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Authorization header for a gateway call. */
export async function gatewayAuthHeader(): Promise<{ authorization: string }> {
  return { authorization: `Bearer ${await gatewayToken()}` };
}
