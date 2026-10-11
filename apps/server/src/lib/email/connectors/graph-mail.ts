import { providerFetch, ProviderHttpError, type TokenCtx } from "../../accounts/provider-http";
import type { BackfillStep, EmailConnector, RawIncoming, SyncContext } from "../types";

// Microsoft Graph mail. Head = messages received since the cursor (all
// folders, 10-minute overlap, dedupe via filterNew); backfill = /me/messages
// newest → oldest by @odata.nextLink. Bodies are fetched as raw MIME
// ($value) so parsing shares the IMAP path. Junk, Deleted Items and Drafts
// are never imported; Sent Items imports as outbound.

const API = "https://graph.microsoft.com/v1.0/me";
const CONCURRENCY = 6;
const INGEST_CHUNK = 40;
const HEAD_OVERLAP_MS = 10 * 60_000;
const SELECT = "id,conversationId,isRead,receivedDateTime,parentFolderId";

interface GraphMessage {
  id: string;
  conversationId?: string;
  isRead?: boolean;
  receivedDateTime?: string;
  parentFolderId?: string;
}

interface Folders {
  skip: string[];
  sent: string;
}

const graph = <T>(ctx: TokenCtx, path: string, init?: Parameters<typeof providerFetch>[3]) =>
  providerFetch<T>("microsoft", ctx, path.startsWith("http") ? path : `${API}${path}`, init);

async function wellKnownFolders(ctx: TokenCtx): Promise<Folders> {
  const ids = await Promise.all(
    ["junkemail", "deleteditems", "drafts", "sentitems"].map((name) =>
      graph<{ id: string }>(ctx, `/mailFolders/${name}?$select=id`).then(
        (f) => f.id,
        () => "",
      ),
    ),
  );
  return { skip: ids.slice(0, 3).filter(Boolean), sent: ids[3] };
}

async function fetchRaw(ctx: TokenCtx, m: GraphMessage, folders: Folders): Promise<RawIncoming | null> {
  try {
    const res = await graph<Response>(ctx, `/messages/${m.id}/$value`, { raw: true });
    return {
      providerMessageId: m.id,
      providerThreadId: m.conversationId ?? null,
      raw: Buffer.from(await res.arrayBuffer()),
      isSent: m.parentFolderId === folders.sent,
      isRead: m.isRead ?? true,
      internalDate: m.receivedDateTime ? new Date(m.receivedDateTime) : null,
    };
  } catch (e) {
    if (e instanceof ProviderHttpError && e.status === 404) return null;
    throw e;
  }
}

async function fetchAndIngest(ctx: SyncContext, messages: GraphMessage[], folders: Folders) {
  const wanted = messages.filter((m) => !folders.skip.includes(m.parentFolderId ?? ""));
  const fresh = new Set(await ctx.filterNew(wanted.map((m) => m.id)));
  const todo = wanted.filter((m) => fresh.has(m.id));
  for (let i = 0; i < todo.length; i += INGEST_CHUNK) {
    const chunk = todo.slice(i, i + INGEST_CHUNK);
    const results: (RawIncoming | null)[] = new Array(chunk.length).fill(null);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, chunk.length) }, async () => {
        while (next < chunk.length) {
          const idx = next++;
          results[idx] = await fetchRaw(ctx, chunk[idx], folders);
        }
      }),
    );
    await ctx.ingest(results.filter((r): r is RawIncoming => !!r));
  }
}

export async function graphProfile(ctx: TokenCtx) {
  return graph<{ mail: string | null; userPrincipalName: string; displayName: string | null }>(ctx, "?$select=mail,userPrincipalName,displayName");
}

export const graphMailConnector: EmailConnector = {
  kind: "microsoft",

  async verify(account, credentials, saveCredentials) {
    const profile = await graphProfile({ credentials, saveCredentials: saveCredentials ?? (async () => {}) });
    const address = (profile.mail ?? profile.userPrincipalName).toLowerCase();
    if (address !== account.address.toLowerCase()) throw new Error("microsoft_address_mismatch");
  },

  async pullHead(ctx) {
    const cursor = ctx.account.syncCursor as { since?: string };
    const now = new Date();
    if (!cursor.since) {
      const count = await graph<number>(ctx, "/messages/$count", { headers: { ConsistencyLevel: "eventual" } }).catch(() => null);
      return {
        cursor: { since: now.toISOString() },
        backfillCursor: { next: null, before: now.toISOString() },
        total: typeof count === "number" ? count : null,
      };
    }
    const folders = await wellKnownFolders(ctx);
    const since = new Date(new Date(cursor.since).getTime() - HEAD_OVERLAP_MS).toISOString();
    let url: string | undefined = `/messages?$select=${SELECT}&$filter=receivedDateTime ge ${since}&$orderby=receivedDateTime asc&$top=100`;
    while (url) {
      const page: { value: GraphMessage[]; "@odata.nextLink"?: string } = await graph(ctx, url);
      await fetchAndIngest(ctx, page.value, folders);
      url = page["@odata.nextLink"];
    }
    return { cursor: { since: now.toISOString() } };
  },

  async pullBackfill(ctx): Promise<BackfillStep> {
    const tail = (ctx.account.backfillCursor ?? {}) as { next?: string | null; before?: string };
    const progress = ctx.account.backfillProgress as { done?: number; total?: number };
    const folders = await wellKnownFolders(ctx);
    const url =
      tail.next ?? `/messages?$select=${SELECT}&$filter=receivedDateTime lt ${tail.before ?? new Date().toISOString()}&$orderby=receivedDateTime desc&$top=50`;
    const page: { value: GraphMessage[]; "@odata.nextLink"?: string } = await graph(ctx, url);
    await fetchAndIngest(ctx, page.value, folders);
    const done = (progress.done ?? 0) + page.value.length;
    const next = page["@odata.nextLink"];
    return { cursor: next ? { next, before: tail.before } : null, done, total: progress.total ?? null };
  },

  async send(ctx, mime) {
    await graph(ctx, "/sendMail", { method: "POST", body: mime.toString("base64"), headers: { "content-type": "text/plain" } });
    return { providerMessageId: null, providerThreadId: null };
  },
};
