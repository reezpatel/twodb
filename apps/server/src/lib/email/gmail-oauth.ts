import { env } from "../../env";
import { getPrivateSetting, setPrivateSetting } from "../server-settings";
import { seal, unseal } from "./crypto";
import { EmailAuthError } from "./types";

// Self-hosted Google OAuth client per deployment. The client secret is
// sealed in a private server_setting row (never part of public settings).

const SETTING_KEY = "emailGmailOAuth";
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send", "openid", "email"];
const STATE_TTL_MS = 15 * 60_000;

interface StoredGmailOAuth {
  clientId: string;
  clientSecret: string;
}

export interface GmailOAuthState {
  organizationId: string;
  userId: string;
  /** Reconnect an existing account instead of creating one. */
  accountId?: string | null;
  exp: number;
}

export function gmailRedirectUri(): string {
  return `${env.auth.url.replace(/\/$/, "")}/api/email/accounts/gmail/oauth/callback`;
}

export async function getGmailOAuthConfig(): Promise<{ clientId: string; clientSecret: string } | null> {
  const stored = await getPrivateSetting<StoredGmailOAuth>(SETTING_KEY);
  if (!stored?.clientId || !stored.clientSecret) return null;
  return { clientId: stored.clientId, clientSecret: unseal<string>(stored.clientSecret) ?? "" };
}

export async function getGmailOAuthPublic() {
  const stored = await getPrivateSetting<StoredGmailOAuth>(SETTING_KEY);
  return { configured: !!stored?.clientId && !!stored.clientSecret, clientId: stored?.clientId ?? "", redirectUri: gmailRedirectUri() };
}

export async function setGmailOAuthConfig(clientId: string, clientSecret: string | null) {
  const stored = await getPrivateSetting<StoredGmailOAuth>(SETTING_KEY);
  const secret = clientSecret ? seal(clientSecret) : stored?.clientSecret;
  if (!secret) throw new Error("client_secret_required");
  await setPrivateSetting(SETTING_KEY, { clientId, clientSecret: secret });
}

export async function clearGmailOAuthConfig() {
  await setPrivateSetting(SETTING_KEY, null);
}

export async function gmailAuthUrl(state: Omit<GmailOAuthState, "exp">): Promise<string> {
  const config = await getGmailOAuthConfig();
  if (!config) throw new Error("gmail_oauth_not_configured");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: gmailRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: Buffer.from(seal({ ...state, exp: Date.now() + STATE_TTL_MS })).toString("base64url"),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function readGmailState(raw: string): GmailOAuthState {
  const state = unseal<GmailOAuthState>(Buffer.from(raw, "base64url").toString("utf8"));
  if (!state || state.exp < Date.now()) throw new Error("oauth_state_expired");
  return state;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    if (json.error === "invalid_grant" || json.error === "unauthorized_client") throw new EmailAuthError(`gmail_${json.error}`);
    throw new Error(`gmail_token_failed: ${json.error_description ?? json.error ?? res.status}`);
  }
  return json;
}

export async function exchangeGmailCode(code: string) {
  const config = await getGmailOAuthConfig();
  if (!config) throw new Error("gmail_oauth_not_configured");
  const json = await tokenRequest({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: gmailRedirectUri(),
    grant_type: "authorization_code",
  });
  if (!json.refresh_token) throw new Error("gmail_no_refresh_token");
  return { refreshToken: json.refresh_token, accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
}

export async function refreshGmailToken(refreshToken: string) {
  const config = await getGmailOAuthConfig();
  if (!config) throw new EmailAuthError("gmail_oauth_not_configured");
  const json = await tokenRequest({ refresh_token: refreshToken, client_id: config.clientId, client_secret: config.clientSecret, grant_type: "refresh_token" });
  return { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
}
