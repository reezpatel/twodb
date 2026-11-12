import { challengeFor, randomString } from "./pkce.js";

export interface TwoDbAuthConfig {
  /**
   * Origin of the TwoDB webapp that hosts /authorize (where the user actually signs in).
   * Default: `import.meta.env.VITE_TWODB_UI_URL`, else http://localhost:6500.
   */
  twodbUrl?: string;
  /** Base of the gateway API as seen from this webapp ("" = same origin, via the dev proxy / production gateway). */
  gatewayBase?: string;
  /** localStorage key prefix. */
  storageKey?: string;
}

export interface TwoDbUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface Stored {
  token: string;
  expiresAt: string;
}

const PENDING = "pending";

export function resolveConfig(c: TwoDbAuthConfig = {}) {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    twodbUrl: (c.twodbUrl ?? env.VITE_TWODB_UI_URL ?? "http://localhost:6500").replace(/\/+$/, ""),
    gatewayBase: (c.gatewayBase ?? "").replace(/\/+$/, ""),
    storageKey: c.storageKey ?? "twodb.auth",
  };
}
export type ResolvedConfig = ReturnType<typeof resolveConfig>;

export function loadToken(cfg: ResolvedConfig): string | null {
  try {
    const raw = localStorage.getItem(cfg.storageKey);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (Date.parse(s.expiresAt) <= Date.now()) {
      localStorage.removeItem(cfg.storageKey);
      return null;
    }
    return s.token;
  } catch {
    return null;
  }
}

export function saveToken(cfg: ResolvedConfig, s: Stored) {
  localStorage.setItem(cfg.storageKey, JSON.stringify(s));
}

export function clearToken(cfg: ResolvedConfig) {
  localStorage.removeItem(cfg.storageKey);
}

/** Redirects the browser to TwoDB to sign in; it comes back to the current page with ?code&state. */
export async function startLogin(cfg: ResolvedConfig, returnTo: string = window.location.href): Promise<void> {
  const verifier = randomString(48);
  const state = randomString(16);
  const redirectUri = new URL(returnTo);
  redirectUri.search = "";
  redirectUri.hash = "";
  sessionStorage.setItem(
    `${cfg.storageKey}.${PENDING}`,
    JSON.stringify({ verifier, state, redirectUri: redirectUri.toString(), returnTo }),
  );
  const url = new URL(`${cfg.twodbUrl}/authorize`);
  url.searchParams.set("redirect_uri", redirectUri.toString());
  url.searchParams.set("code_challenge", await challengeFor(verifier));
  url.searchParams.set("state", state);
  window.location.assign(url.toString());
}

/**
 * If the URL carries ?code&state from TwoDB, exchanges it for a session token, stores it and
 * cleans the URL. Returns true when a login was completed.
 */
export async function completeLoginIfCallback(cfg: ResolvedConfig): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return false;
  const raw = sessionStorage.getItem(`${cfg.storageKey}.${PENDING}`);
  if (!raw) return false;
  const pending = JSON.parse(raw) as { verifier: string; state: string; redirectUri: string; returnTo: string };
  if (pending.state !== state) throw new Error("login state mismatch — start again");
  sessionStorage.removeItem(`${cfg.storageKey}.${PENDING}`);
  const res = await fetch(`${cfg.gatewayBase}/registry/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, codeVerifier: pending.verifier, redirectUri: pending.redirectUri }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const body = (await res.json()) as { accessToken: string; expiresAt: string };
  saveToken(cfg, { token: body.accessToken, expiresAt: body.expiresAt });
  // Back to where the user was (without the code/state params).
  const back = new URL(pending.returnTo);
  window.history.replaceState({}, "", back.pathname + back.search + back.hash);
  return true;
}

/** Current user for a token, or null when it is invalid/expired. */
export async function fetchUser(cfg: ResolvedConfig, token: string): Promise<TwoDbUser | null> {
  const res = await fetch(`${cfg.gatewayBase}/api/auth/get-session`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { user?: TwoDbUser } | null;
  return body?.user ?? null;
}

export async function revokeToken(cfg: ResolvedConfig, token: string): Promise<void> {
  await fetch(`${cfg.gatewayBase}/api/auth/sign-out`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" }).catch(() => {});
}

const GATEWAY_PATH = /^\/(apps|registry|orchestrator|search|api)(\/|$)/;

let tokenSource: (() => string | null) | null = null;
let patched = false;

/**
 * Makes every request this webapp sends to the gateway carry the session as
 * `Authorization: Bearer` — so existing `fetch("/apps/<slug>/…")` calls work unchanged.
 * Idempotent (safe under React StrictMode / HMR): patches window.fetch once and just
 * re-points the token source on later calls.
 */
export function installAuthFetch(cfg: ResolvedConfig, getToken: () => string | null): void {
  tokenSource = getToken;
  if (patched) return;
  patched = true;
  // WebSocket / EventSource can't carry headers: pass the token as ?access_token= (the gateway
  // promotes it to Authorization and strips it before it reaches the app).
  const withToken = (raw: string | URL): string | URL => {
    const token = tokenSource?.() ?? null;
    if (!token) return raw;
    try {
      const u = new URL(raw.toString(), window.location.href);
      const sameHost = u.host === window.location.host;
      if (!sameHost || !GATEWAY_PATH.test(u.pathname)) return raw;
      u.searchParams.set("access_token", token);
      return u.toString();
    } catch {
      return raw;
    }
  };
  const NativeWS = window.WebSocket;
  window.WebSocket = new Proxy(NativeWS, {
    construct: (target, args: [string | URL, (string | string[])?]) => Reflect.construct(target, [withToken(args[0]), args[1]]),
  });
  const NativeES = window.EventSource;
  if (NativeES) {
    window.EventSource = new Proxy(NativeES, {
      construct: (target, args: [string | URL, EventSourceInit?]) => Reflect.construct(target, [withToken(args[0]), args[1]]),
    });
  }
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const token = tokenSource?.() ?? null;
    if (token) {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const u = new URL(raw, window.location.origin);
      const toGateway = cfg.gatewayBase ? raw.startsWith(cfg.gatewayBase) : u.origin === window.location.origin && GATEWAY_PATH.test(u.pathname);
      if (toGateway) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
        return original(input, { ...init, headers });
      }
    }
    return original(input, init);
  };
}
