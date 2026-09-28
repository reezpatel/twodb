import { db } from "../auth";
import type { LlmConnectionTable } from "../plugins/db";

// OAuth refresh endpoints for token-exchange providers. Public client ids
// used by the first-party CLIs; tokens come from the user's own login.
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

const ALLOWED_TOKEN_HOSTS = new Set(["console.anthropic.com", "auth.openai.com"]);

const EXPIRY_SLACK_MS = 120_000;

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

/**
 * Returns the connection config with a fresh access token when the provider
 * uses OAuth token exchange (claude-code, codex). Refreshed tokens are
 * persisted back to the connection row. Non-OAuth providers pass through.
 */
export async function ensureFreshTokens(connection: LlmConnectionTable): Promise<Record<string, string>> {
  const config = { ...(connection.config as Record<string, string>) };
  const oauth = OAUTH[connection.provider];
  if (!oauth || !config.refresh_token) return config;

  const expiresAt = Date.parse(config.expires_at ?? "");
  if (config.access_token && Number.isFinite(expiresAt) && expiresAt - EXPIRY_SLACK_MS > Date.now()) {
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
    refresh_token: config.refresh_token,
    client_id: oauth.clientId,
  };
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": oauth.form ? "application/x-www-form-urlencoded" : "application/json" },
    body: oauth.form ? new URLSearchParams(payload) : JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    if (config.access_token) return config; // stale token still beats none
    throw new Error(`token refresh failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const tokens = (await res.json()) as TokenResponse;
  if (!tokens.access_token) throw new Error("token refresh returned no access_token");
  config.access_token = tokens.access_token;
  if (tokens.refresh_token) config.refresh_token = tokens.refresh_token;
  if (tokens.expires_in) config.expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await db.updateTable("llm_connection").set({ config }).where("id", "=", connection.id).executeTakeFirst();

  return config;
}
