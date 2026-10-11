import { refreshGmailToken } from "../email/gmail-oauth";
import { EmailAuthError } from "../email/types";
import { refreshMicrosoftToken } from "./microsoft-oauth";

// Token refresh + retrying JSON fetch shared by the Google and Microsoft
// connectors (mail and calendar use the same sealed credentials).

export interface TokenCtx {
  credentials: Record<string, unknown>;
  saveCredentials: (next: Record<string, unknown>) => Promise<void>;
}

interface OAuthCredentials {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
}

export class ProviderHttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public body = "",
  ) {
    super(message);
  }
}

export type Provider = "google" | "microsoft";

async function accessToken(provider: Provider, ctx: TokenCtx, force: boolean): Promise<string> {
  const creds = ctx.credentials as unknown as OAuthCredentials;
  if (!creds.refreshToken) throw new EmailAuthError(`${provider}_missing_refresh_token`);
  if (!force && creds.accessToken && (creds.expiresAt ?? 0) > Date.now() + 60_000) return creds.accessToken;
  const fresh = provider === "google" ? await refreshGmailToken(creds.refreshToken) : await refreshMicrosoftToken(creds.refreshToken);
  const next = { ...ctx.credentials, ...fresh };
  ctx.credentials = next;
  await ctx.saveCredentials(next);
  return fresh.accessToken;
}

export interface ProviderRequest extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Return the raw Response (for $value / binary bodies). */
  raw?: boolean;
  /** Treat these statuses as success with a null result. */
  allow?: number[];
}

/** Authorized request with token refresh on 401 and backoff on 429/5xx. */
export async function providerFetch<T>(provider: Provider, ctx: TokenCtx, url: string, init: ProviderRequest = {}, attempt = 0): Promise<T> {
  const token = await accessToken(provider, ctx, attempt > 0 && attempt < 2);
  const headers: Record<string, string> = { authorization: `Bearer ${token}`, ...(init.headers as Record<string, string>) };
  let body: string | Uint8Array | undefined;
  if (init.body !== undefined) {
    if (typeof init.body === "string" || init.body instanceof Uint8Array) body = init.body as string | Uint8Array;
    else {
      body = JSON.stringify(init.body);
      headers["content-type"] ??= "application/json";
    }
  }
  const res = await fetch(url, { ...init, headers, body: body as RequestInit["body"] });
  if (res.status === 401 && attempt === 0) return providerFetch(provider, ctx, url, init, 1);
  if ((res.status === 429 || res.status === 503 || res.status === 504 || res.status === 500 || (provider === "google" && res.status === 403)) && attempt < 5) {
    const text = await res.text();
    if (res.status === 403 && !/rate|quota|limit/i.test(text)) throw new EmailAuthError(`${provider}_forbidden: ${text.slice(0, 200)}`);
    const retryAfter = Number(res.headers.get("retry-after"));
    await new Promise((r) => setTimeout(r, retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt + Math.random() * 500));
    return providerFetch(provider, ctx, url, init, attempt + 1);
  }
  if (init.allow?.includes(res.status)) return null as T;
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new EmailAuthError(`${provider}_unauthorized`);
    throw new ProviderHttpError(res.status, `${provider} ${init.method ?? "GET"} ${url.split("?")[0]} ${res.status}: ${text.slice(0, 300)}`, text);
  }
  if (init.raw) return res as unknown as T;
  if (res.status === 204 || res.status === 202) return null as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
