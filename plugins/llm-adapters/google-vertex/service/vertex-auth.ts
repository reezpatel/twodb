import { createSign } from "node:crypto";

type ServiceAccountKey = {
  client_email?: unknown;
  private_key?: unknown;
  token_uri?: unknown;
};

type ParsedServiceAccount = { clientEmail: string; privateKey: string; tokenUri: string };

type CachedToken = { token: string; expiresAtMs: number };

const tokenCache = new Map<string, CachedToken>();
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const TOKEN_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const TOKEN_ENDPOINT_PATTERN = /^https:\/\/[A-Za-z0-9.-]+\.googleapis\.com\/token$/;

function parseServiceAccount(json: string): ParsedServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Vertex AI service account JSON is not valid JSON");
  }
  const record = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as ServiceAccountKey) : null;
  const clientEmail = typeof record?.client_email === "string" ? record.client_email.trim() : "";
  const privateKey = typeof record?.private_key === "string" ? record.private_key.replace(/\\n/g, "\n").trim() : "";
  if (!clientEmail || !privateKey) {
    throw new Error("Vertex AI service account JSON is missing client_email or private_key");
  }
  const tokenUri = typeof record?.token_uri === "string" && record.token_uri.trim() ? record.token_uri.trim() : DEFAULT_TOKEN_URI;
  if (!TOKEN_ENDPOINT_PATTERN.test(tokenUri)) {
    throw new Error("Vertex AI service account token_uri must be a Google OAuth endpoint");
  }
  return { clientEmail, privateKey, tokenUri };
}

function signJwt(clientEmail: string, privateKey: string, audience: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: clientEmail,
    scope: TOKEN_SCOPE,
    aud: audience,
    iat: issuedAt,
    exp: issuedAt + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url");
  return `${unsigned}.${signature}`;
}

export async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const { clientEmail, privateKey, tokenUri } = parseServiceAccount(serviceAccountJson);
  const cached = tokenCache.get(clientEmail);
  if (cached && cached.expiresAtMs > Date.now() + 60_000) return cached.token;

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signJwt(clientEmail, privateKey, tokenUri),
    }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google OAuth token exchange failed (${response.status}): ${text.replace(/\s+/g, " ").trim().slice(0, 200)}`);
  }

  let payload: { access_token?: unknown; expires_in?: unknown };
  try {
    payload = JSON.parse(text) as { access_token?: unknown; expires_in?: unknown };
  } catch {
    throw new Error("Google OAuth token response was not valid JSON");
  }
  const token = typeof payload.access_token === "string" ? payload.access_token : "";
  if (!token) throw new Error("Google OAuth token response is missing access_token");
  const expiresIn = typeof payload.expires_in === "number" && payload.expires_in > 0 ? payload.expires_in : 3600;
  tokenCache.set(clientEmail, { token, expiresAtMs: Date.now() + expiresIn * 1000 });
  return token;
}
