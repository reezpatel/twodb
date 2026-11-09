import { env } from "../../env";
import { getPrivateSetting, setPrivateSetting } from "../server-settings";
import { seal, unseal } from "../email/crypto";
import { EmailAuthError, type AccountCapability } from "../email/types";

// Self-hosted Microsoft Entra app per deployment (tenant "common" covers
// outlook.com and work accounts). The secret is sealed in a private setting.

const SETTING_KEY = "accountsMicrosoftOAuth";
const STATE_TTL_MS = 15 * 60_000;
const BASE_SCOPES = ["offline_access", "openid", "email", "profile", "User.Read"];
const CAPABILITY_SCOPES: Record<AccountCapability, string[]> = {
  mail: ["Mail.ReadWrite", "Mail.Send"],
  calendar: ["Calendars.ReadWrite"],
};

interface StoredMicrosoftOAuth {
  clientId: string;
  clientSecret: string;
  tenant?: string;
}

export interface MicrosoftOAuthState {
  organizationId: string;
  userId: string;
  accountId?: string | null;
  capabilities: AccountCapability[];
  exp: number;
}

export function microsoftRedirectUri(): string {
  return `${env.auth.url.replace(/\/$/, "")}/api/email/accounts/microsoft/oauth/callback`;
}

export async function getMicrosoftOAuthConfig(): Promise<{ clientId: string; clientSecret: string; tenant: string } | null> {
  const stored = await getPrivateSetting<StoredMicrosoftOAuth>(SETTING_KEY);
  if (!stored?.clientId || !stored.clientSecret) return null;
  return { clientId: stored.clientId, clientSecret: unseal<string>(stored.clientSecret) ?? "", tenant: stored.tenant || "common" };
}

export async function getMicrosoftOAuthPublic() {
  const stored = await getPrivateSetting<StoredMicrosoftOAuth>(SETTING_KEY);
  return {
    configured: !!stored?.clientId && !!stored.clientSecret,
    clientId: stored?.clientId ?? "",
    tenant: stored?.tenant || "common",
    redirectUri: microsoftRedirectUri(),
  };
}

export async function setMicrosoftOAuthConfig(clientId: string, clientSecret: string | null, tenant: string | null) {
  const stored = await getPrivateSetting<StoredMicrosoftOAuth>(SETTING_KEY);
  const secret = clientSecret ? seal(clientSecret) : stored?.clientSecret;
  if (!secret) throw new Error("client_secret_required");
  await setPrivateSetting(SETTING_KEY, { clientId, clientSecret: secret, tenant: tenant || "common" });
}

export async function clearMicrosoftOAuthConfig() {
  await setPrivateSetting(SETTING_KEY, null);
}

export function microsoftScopes(capabilities: AccountCapability[]): string[] {
  return [...BASE_SCOPES, ...capabilities.flatMap((c) => CAPABILITY_SCOPES[c])];
}

/** Which capabilities a granted scope list covers (Graph returns scopes with or without the resource prefix). */
export function microsoftCapabilitiesFor(scopes: string[]): AccountCapability[] {
  const granted = new Set(scopes.map((s) => s.toLowerCase().replace("https://graph.microsoft.com/", "")));
  return (Object.keys(CAPABILITY_SCOPES) as AccountCapability[]).filter((c) => CAPABILITY_SCOPES[c].every((s) => granted.has(s.toLowerCase())));
}

export async function microsoftAuthUrl(state: Omit<MicrosoftOAuthState, "exp">): Promise<string> {
  const config = await getMicrosoftOAuthConfig();
  if (!config) throw new Error("microsoft_oauth_not_configured");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: microsoftRedirectUri(),
    response_type: "code",
    response_mode: "query",
    scope: microsoftScopes(state.capabilities).join(" "),
    prompt: "select_account",
    state: Buffer.from(seal({ ...state, exp: Date.now() + STATE_TTL_MS })).toString("base64url"),
  });
  return `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/authorize?${params}`;
}

export function readMicrosoftState(raw: string): MicrosoftOAuthState {
  const state = unseal<MicrosoftOAuthState>(Buffer.from(raw, "base64url").toString("utf8"));
  if (!state || state.exp < Date.now()) throw new Error("oauth_state_expired");
  return state;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const config = await getMicrosoftOAuthConfig();
  if (!config) throw new EmailAuthError("microsoft_oauth_not_configured");
  const res = await fetch(`https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...body }),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    if (json.error === "invalid_grant" || json.error === "unauthorized_client" || json.error === "interaction_required")
      throw new EmailAuthError(`microsoft_${json.error}`);
    throw new Error(`microsoft_token_failed: ${json.error_description ?? json.error ?? res.status}`);
  }
  return json;
}

export interface MicrosoftTokens {
  refreshToken: string;
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

export async function exchangeMicrosoftCode(code: string): Promise<MicrosoftTokens> {
  const json = await tokenRequest({ code, redirect_uri: microsoftRedirectUri(), grant_type: "authorization_code" });
  if (!json.refresh_token) throw new Error("microsoft_no_refresh_token");
  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    scopes: (json.scope ?? "").split(" ").filter(Boolean),
  };
}

/** Microsoft rotates refresh tokens — callers must persist the returned one. */
export async function refreshMicrosoftToken(refreshToken: string) {
  const json = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  return { accessToken: json.access_token, refreshToken: json.refresh_token ?? refreshToken, expiresAt: Date.now() + json.expires_in * 1000 };
}
