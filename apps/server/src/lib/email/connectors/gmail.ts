import { refreshGmailToken } from "../gmail-oauth";
import { EmailAuthError, type BackfillStep, type EmailConnector, type RawIncoming, type SyncContext } from "../types";

// Gmail REST API. Head = history.list(messageAdded) from the stored
// historyId; backfill = messages.list newest → oldest by pageToken. Bodies are
// fetched as format=raw so parsing shares the IMAP path. Provider labels are
// read once (SENT / UNREAD) and SPAM / TRASH / DRAFT are never imported.

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const SKIP_LABELS = new Set(["SPAM", "TRASH", "DRAFT"]);
const CONCURRENCY = 8;
const INGEST_CHUNK = 50;

interface GmailCredentials {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
}

type TokenCtx = Pick<SyncContext, "credentials" | "saveCredentials">;

class GmailHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function accessToken(ctx: TokenCtx, force = false): Promise<string> {
  const creds = ctx.credentials as unknown as GmailCredentials;
  if (!creds.refreshToken) throw new EmailAuthError("gmail_missing_refresh_token");
  if (!force && creds.accessToken && (creds.expiresAt ?? 0) > Date.now() + 60_000) return creds.accessToken;
  const fresh = await refreshGmailToken(creds.refreshToken);
  const next = { ...creds, accessToken: fresh.accessToken, expiresAt: fresh.expiresAt };
  ctx.credentials = next as unknown as Record<string, unknown>;
  await ctx.saveCredentials(next as unknown as Record<string, unknown>);
  return fresh.accessToken;
}

async function gmail<T>(ctx: TokenCtx, path: string, init?: RequestInit, attempt = 0): Promise<T> {
  const token = await accessToken(ctx, attempt > 0);
  const res = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init?.headers } });
  if (res.status === 401 && attempt === 0) return gmail(ctx, path, init, 1);
  if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt < 4) {
    const body = await res.text();
    if (res.status === 403 && !/rate|quota/i.test(body)) throw new EmailAuthError(`gmail_forbidden: ${body.slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt + Math.random() * 500));
    return gmail(ctx, path, init, attempt + 1);
  }
  if (!res.ok) {
    if (res.status === 401) throw new EmailAuthError("gmail_unauthorized");
    throw new GmailHttpError(res.status, `gmail ${path.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

interface Profile {
  emailAddress: string;
  messagesTotal: number;
  historyId: string;
}

interface RawMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate?: string;
  raw: string;
}

async function fetchOne(ctx: TokenCtx, id: string): Promise<RawIncoming | null> {
  try {
    const m = await gmail<RawMessage>(ctx, `/messages/${id}?format=raw`);
    const labels = new Set(m.labelIds ?? []);
    if ([...labels].some((l) => SKIP_LABELS.has(l))) return null;
    return {
      providerMessageId: m.id,
      providerThreadId: m.threadId,
      raw: Buffer.from(m.raw, "base64url"),
      isSent: labels.has("SENT"),
      isRead: !labels.has("UNREAD"),
      internalDate: m.internalDate ? new Date(Number(m.internalDate)) : null,
    };
  } catch (e) {
    if (e instanceof GmailHttpError && e.status === 404) return null;
    throw e;
  }
}

/** Fetches raw bodies with bounded concurrency, ingesting in chunks so progress lands as we go. */
async function fetchAndIngest(ctx: SyncContext, ids: string[]) {
  const fresh = await ctx.filterNew(ids);
  for (let i = 0; i < fresh.length; i += INGEST_CHUNK) {
    const chunk = fresh.slice(i, i + INGEST_CHUNK);
    const results: (RawIncoming | null)[] = new Array(chunk.length).fill(null);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, chunk.length) }, async () => {
        while (next < chunk.length) {
          const idx = next++;
          results[idx] = await fetchOne(ctx, chunk[idx]);
        }
      }),
    );
    await ctx.ingest(results.filter((r): r is RawIncoming => !!r));
  }
}

export async function gmailProfile(ctx: TokenCtx): Promise<Profile> {
  return gmail<Profile>(ctx, "/profile");
}

export const gmailConnector: EmailConnector = {
  kind: "google",

  async verify(account, credentials, saveCredentials) {
    const profile = await gmailProfile({ credentials, saveCredentials: saveCredentials ?? (async () => {}) });
    if (profile.emailAddress.toLowerCase() !== account.address.toLowerCase()) throw new Error("gmail_address_mismatch");
  },

  async pullHead(ctx) {
    const cursor = ctx.account.syncCursor as { historyId?: string };
    if (!cursor.historyId) {
      const profile = await gmailProfile(ctx);
      return { cursor: { historyId: profile.historyId }, backfillCursor: { pageToken: null }, total: profile.messagesTotal };
    }
    const added: string[] = [];
    let pageToken: string | undefined;
    let latest = cursor.historyId;
    try {
      do {
        const params = new URLSearchParams({ startHistoryId: cursor.historyId, historyTypes: "messageAdded", maxResults: "500" });
        if (pageToken) params.set("pageToken", pageToken);
        const page = await gmail<{
          history?: { messagesAdded?: { message: { id: string; labelIds?: string[] } }[] }[];
          historyId?: string;
          nextPageToken?: string;
        }>(ctx, `/history?${params}`);
        for (const h of page.history ?? []) {
          for (const a of h.messagesAdded ?? []) {
            if ((a.message.labelIds ?? []).some((l) => SKIP_LABELS.has(l))) continue;
            added.push(a.message.id);
          }
        }
        if (page.historyId) latest = page.historyId;
        pageToken = page.nextPageToken;
      } while (pageToken);
    } catch (e) {
      if (e instanceof GmailHttpError && e.status === 404) {
        const profile = await gmailProfile(ctx);
        return { cursor: { historyId: profile.historyId }, backfillCursor: { pageToken: null }, total: profile.messagesTotal };
      }
      throw e;
    }
    await fetchAndIngest(ctx, [...new Set(added)]);
    return { cursor: { historyId: latest } };
  },

  async pullBackfill(ctx): Promise<BackfillStep> {
    const tail = (ctx.account.backfillCursor ?? {}) as { pageToken?: string | null };
    const progress = ctx.account.backfillProgress as { done?: number; total?: number };
    const params = new URLSearchParams({ maxResults: "100", q: "-in:drafts -in:spam -in:trash" });
    if (tail.pageToken) params.set("pageToken", tail.pageToken);
    const page = await gmail<{ messages?: { id: string }[]; nextPageToken?: string; resultSizeEstimate?: number }>(ctx, `/messages?${params}`);
    const ids = (page.messages ?? []).map((m) => m.id);
    await fetchAndIngest(ctx, ids);
    const done = (progress.done ?? 0) + ids.length;
    return { cursor: page.nextPageToken ? { pageToken: page.nextPageToken } : null, done, total: progress.total ?? null };
  },

  async send(ctx, mime, _envelope, hint) {
    const body: { raw: string; threadId?: string } = { raw: mime.toString("base64url") };
    if (hint.providerThreadId) body.threadId = hint.providerThreadId;
    const res = await gmail<{ id: string; threadId: string }>(ctx, "/messages/send", { method: "POST", body: JSON.stringify(body) });
    return { providerMessageId: res.id, providerThreadId: res.threadId };
  },
};
