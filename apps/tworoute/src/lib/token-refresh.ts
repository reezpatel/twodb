import type { Kysely } from "kysely";
import type { TwoRouteDb } from "../db/schema.js";
import type { ConnectionConfig } from "../db/repository.js";

// OAuth refresh endpoints for token-exchange providers. Public client ids
// used by the first-party CLIs; tokens come from the user's own login.
// Ported from the legacy app's lib/token-refresh.ts, adapted to the typed
// config column.
const OAUTH: Record<string, { url: string; clientId: string; form?: boolean }> = {
  "claude-code": {
    url: "https://console.anthropic.com/v1/oauth/token",
    clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  },
  codex: {
    url: "https://auth.openai.com/oauth/token",
    clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
    form: true,
  },
};

/** Providers whose credentials are OAuth-refreshable. */
export const OAUTH_PROVIDERS = new Set(Object.keys(OAUTH));

const ALLOWED_TOKEN_HOSTS = new Set(["console.anthropic.com", "auth.openai.com"]);
const EXPIRY_SLACK_MS = 120_000;

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface LiveConnection {
  id: string;
  workspace_id: string;
  provider: string;
  base_url: string;
  api_key: string;
  default_model: string | null;
  configParsed: ConnectionConfig;
}

/**
 * Returns the connection with a fresh OAuth access token when the provider
 * uses OAuth token exchange (claude-code, codex). Refreshed tokens are
 * persisted back to the connection's config column. Non-OAuth providers
 * pass through.
 *
 * Config keys are normalized: the UI stores camelCase (accessToken /
 * refreshToken / accountId / expiresAt — the ConnectionDialog field keys)
 * while the legacy import used snake_case (access_token / refresh_token /
 * account_id / expires_at — what the OAuth flows return). Both are read;
 * writes keep whichever casing the connection already used.
 */
function configGet(config: ConnectionConfig, camel: string, snake: string): string | undefined {
  return config[camel] ?? config[snake];
}

export async function ensureFreshTokens(
  connection: LiveConnection,
  db: Kysely<TwoRouteDb>,
  encrypt: (s: string) => string,
  { force = false }: { force?: boolean } = {},
): Promise<ConnectionConfig> {
  const config = { ...connection.configParsed };
  const oauth = OAUTH[connection.provider];
  const refreshToken = configGet(config, "refreshToken", "refresh_token");
  if (!oauth || !refreshToken) return config;

  const snakeStyle = "refresh_token" in config && !("refreshToken" in config);
  const accessKey = snakeStyle ? "access_token" : "accessToken";
  const refreshKey = snakeStyle ? "refresh_token" : "refreshToken";
  const expiresKey = snakeStyle ? "expires_at" : "expiresAt";

  const expiresAt = Date.parse(config[expiresKey] ?? "");
  if (!force && config[accessKey] && Number.isFinite(expiresAt) && expiresAt - EXPIRY_SLACK_MS > Date.now()) {
    return config;
  }

  let tokenUrl: URL;
  try {
    tokenUrl = new URL(oauth.url);
  } catch {
    throw new Error(`invalid token endpoint for provider "${connection.provider}"`);
  }
  if (!ALLOWED_TOKEN_HOSTS.has(tokenUrl.host)) {
    throw new Error(`token endpoint host not allowed: ${tokenUrl.host}`);
  }

  const payload = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: oauth.clientId,
  };
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": oauth.form ? "application/x-www-form-urlencoded" : "application/json" },
    body: oauth.form ? new URLSearchParams(payload) : JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    if (config[accessKey]) return config; // stale token still beats none
    throw new Error(`token refresh failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const tokens = (await res.json()) as TokenResponse;
  if (!tokens.access_token) throw new Error("token refresh returned no access_token");
  config[accessKey] = tokens.access_token;
  if (tokens.refresh_token) config[refreshKey] = tokens.refresh_token;
  if (tokens.expires_in) config[expiresKey] = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Persist the refreshed pair back (encrypted config blob).
  const full = { ...config };
  await db
    .updateTable("llm_connection")
    .set({ config: encrypt(JSON.stringify(full)) })
    .where("id", "=", connection.id)
    .execute();

  return config;
}
