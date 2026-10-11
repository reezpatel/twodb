import { Hono, type Context } from "hono";
import { createHash } from "node:crypto";
import { db } from "../auth";
import { env } from "../env";
import { logger } from "../lib/logger";
import { requireOrgSession } from "../lib/session";
import { EmailAccessError, requireAccountRole, requireMessage } from "../lib/email/access";
import {
  createImapAccount,
  deleteAccount,
  listAccounts,
  listMembers,
  loadAccount,
  removeMember,
  setBackfillPaused,
  setVisibility,
  testAccount,
  updateAccount,
  setCapabilities,
  upsertGoogleAccount,
  upsertMember,
  upsertMicrosoftAccount,
} from "../lib/email/accounts";
import {
  clearMicrosoftOAuthConfig,
  exchangeMicrosoftCode,
  getMicrosoftOAuthPublic,
  microsoftAuthUrl,
  readMicrosoftState,
  setMicrosoftOAuthConfig,
} from "../lib/accounts/microsoft-oauth";
import { syncAccountCalendars } from "../lib/calendar/scheduler";
import type { AccountCapability } from "../lib/email/types";
import { IMAP_FIELDS, PRESETS } from "../lib/email/connectors/registry";
import {
  addDraftAttachment,
  cancelSend,
  createDraft,
  discardDraft,
  removeDraftAttachment,
  retrySend,
  sendDraft,
  updateDraft,
  type ComposeKind,
} from "../lib/email/compose";
import { clearGmailOAuthConfig, exchangeGmailCode, getGmailOAuthPublic, gmailAuthUrl, readGmailState, setGmailOAuthConfig } from "../lib/email/gmail-oauth";
import { ingestBatch } from "../lib/email/ingest";
import { createLabel, deleteLabel, listLabels, updateLabel } from "../lib/email/labels";
import { syncAccount } from "../lib/email/scheduler";
import { emailStorageReady, readEmailMedia } from "../lib/email/storage";
import {
  applyThreadAction,
  EMAIL_VIEWS,
  getThreadDetail,
  listThreads,
  purgeMessages,
  purgeView,
  recomputeThread,
  serializeMessages,
  setMessageFlags,
  softDeleteMessage,
  viewCounts,
  type EmailView,
  type ThreadAction,
} from "../lib/email/threads";
import { EmailAuthError } from "../lib/email/types";
import { broadcastEmailEvent, broadcastEmailUserEvent } from "./email-ws";

// Email REST. The UI only ever talks to these endpoints — everything renders
// from local tables; connectors run in the background (lib/email/scheduler).

const THREAD_ACTIONS: ThreadAction[] = [
  "read",
  "unread",
  "star",
  "unstar",
  "pin",
  "unpin",
  "archive",
  "inbox",
  "spam",
  "not_spam",
  "trash",
  "restore",
  "purge",
  "snooze",
  "unsnooze",
  "mute",
  "unmute",
  "label",
];
const INLINE_SAFE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain"]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

async function user(c: Context) {
  const s = await requireOrgSession(c);
  if (!s?.session) return null;
  return { organizationId: s.organizationId, userId: s.session.user.id, role: s.session.user.role };
}

type Handler = (u: NonNullable<Awaited<ReturnType<typeof user>>>, c: Context) => Promise<Response>;

function handle(fn: Handler) {
  return async (c: Context) => {
    const u = await user(c);
    if (!u) return c.json({ error: "unauthorized" }, 401);
    try {
      return await fn(u, c);
    } catch (e) {
      if (e instanceof EmailAccessError) return c.json({ error: e.message }, e.status);
      if (e instanceof EmailAuthError) return c.json({ error: "auth_failed", detail: e.message }, 400);
      const message = (e as Error).message ?? "error";
      if (message === "email_attachments_not_configured") return c.json({ error: message }, 409);
      if (message === "gmail_oauth_not_configured" || message === "microsoft_oauth_not_configured") return c.json({ error: message }, 409);
      logger.error({ err: e, path: c.req.path }, "email route failed");
      return c.json({ error: "request_failed", detail: message }, 500);
    }
  };
}

function capabilitiesOf(value: unknown): AccountCapability[] {
  const list = Array.isArray(value) ? value.filter((v): v is AccountCapability => v === "mail" || v === "calendar") : [];
  return list.length ? [...new Set(list)] : ["mail"];
}

async function body(c: Context): Promise<Record<string, unknown>> {
  return ((await c.req.json().catch(() => null)) as Record<string, unknown> | null) ?? {};
}

async function broadcastTouched(touched: Map<string, string[]>) {
  for (const [accountId, threadIds] of touched) await broadcastEmailEvent(accountId, { type: "thread.updated", accountId, threadIds });
}

async function messageTouched(messageId: string) {
  const row = await db.selectFrom("email_message").select(["accountId", "threadId"]).where("id", "=", messageId).executeTakeFirst();
  if (row) await broadcastEmailEvent(row.accountId, { type: "thread.updated", accountId: row.accountId, threadIds: [row.threadId] });
}

export const emailRoutes = new Hono()
  .get(
    "/meta",
    handle(async (u, c) => {
      return c.json({
        presets: PRESETS,
        imapFields: IMAP_FIELDS,
        gmail: await getGmailOAuthPublic(),
        microsoft: await getMicrosoftOAuthPublic(),
        storageReady: await emailStorageReady(),
        views: EMAIL_VIEWS,
        isAdmin: u.role === "admin",
      });
    }),
  )

  // ── admin: Google OAuth client ───────────────────────────────────────────
  .put(
    "/admin/gmail-oauth",
    handle(async (u, c) => {
      if (u.role !== "admin") return c.json({ error: "forbidden" }, 403);
      const b = await body(c);
      const clientId = typeof b.clientId === "string" ? b.clientId.trim() : "";
      const clientSecret = typeof b.clientSecret === "string" && b.clientSecret.trim() ? b.clientSecret.trim() : null;
      if (!clientId) return c.json({ error: "client_id_required" }, 400);
      await setGmailOAuthConfig(clientId, clientSecret);
      return c.json(await getGmailOAuthPublic());
    }),
  )
  .delete(
    "/admin/gmail-oauth",
    handle(async (u, c) => {
      if (u.role !== "admin") return c.json({ error: "forbidden" }, 403);
      await clearGmailOAuthConfig();
      return c.json(await getGmailOAuthPublic());
    }),
  )

  .put(
    "/admin/microsoft-oauth",
    handle(async (u, c) => {
      if (u.role !== "admin") return c.json({ error: "forbidden" }, 403);
      const b = await body(c);
      const clientId = typeof b.clientId === "string" ? b.clientId.trim() : "";
      const clientSecret = typeof b.clientSecret === "string" && b.clientSecret.trim() ? b.clientSecret.trim() : null;
      const tenant = typeof b.tenant === "string" && b.tenant.trim() ? b.tenant.trim() : null;
      if (!clientId) return c.json({ error: "client_id_required" }, 400);
      await setMicrosoftOAuthConfig(clientId, clientSecret, tenant);
      return c.json(await getMicrosoftOAuthPublic());
    }),
  )
  .delete(
    "/admin/microsoft-oauth",
    handle(async (u, c) => {
      if (u.role !== "admin") return c.json({ error: "forbidden" }, 403);
      await clearMicrosoftOAuthConfig();
      return c.json(await getMicrosoftOAuthPublic());
    }),
  )

  // ── accounts ─────────────────────────────────────────────────────────────
  .get(
    "/accounts",
    handle(async (u, c) => c.json(await listAccounts(u.organizationId, u.userId))),
  )
  .post(
    "/accounts",
    handle(async (u, c) => {
      const id = await createImapAccount(u.organizationId, u.userId, await body(c));
      void syncAccount(id, { force: true });
      void syncAccountCalendars(id, { force: true });
      return c.json({ id }, 201);
    }),
  )
  .post(
    "/accounts/gmail/oauth/start",
    handle(async (u, c) => {
      const b = await body(c);
      const accountId = typeof b.accountId === "string" ? b.accountId : null;
      if (accountId) await requireAccountRole(u.organizationId, u.userId, accountId, "owner");
      return c.json({
        authUrl: await gmailAuthUrl({ organizationId: u.organizationId, userId: u.userId, accountId, capabilities: capabilitiesOf(b.capabilities) }),
      });
    }),
  )
  .get("/accounts/gmail/oauth/callback", async (c) => {
    const back = (params: Record<string, string>) => c.redirect(`${env.auth.url}/apps/settings/accounts?${new URLSearchParams(params)}`);
    const error = c.req.query("error");
    if (error) return back({ oauth: "error", provider: "google", reason: error });
    try {
      const state = readGmailState(c.req.query("state") ?? "");
      const tokens = await exchangeGmailCode(c.req.query("code") ?? "");
      const id = await upsertGoogleAccount(
        state.organizationId,
        state.userId,
        tokens,
        state.capabilities?.length ? state.capabilities : ["mail"],
        state.accountId,
      );
      void syncAccount(id, { force: true });
      void syncAccountCalendars(id, { force: true });
      return back({ oauth: "connected", provider: "google", accountId: id });
    } catch (e) {
      logger.warn({ err: e }, "email: gmail oauth callback failed");
      return back({ oauth: "error", provider: "google", reason: (e as Error).message });
    }
  })
  .post(
    "/accounts/microsoft/oauth/start",
    handle(async (u, c) => {
      const b = await body(c);
      const accountId = typeof b.accountId === "string" ? b.accountId : null;
      if (accountId) await requireAccountRole(u.organizationId, u.userId, accountId, "owner");
      return c.json({
        authUrl: await microsoftAuthUrl({ organizationId: u.organizationId, userId: u.userId, accountId, capabilities: capabilitiesOf(b.capabilities) }),
      });
    }),
  )
  .get("/accounts/microsoft/oauth/callback", async (c) => {
    const back = (params: Record<string, string>) => c.redirect(`${env.auth.url}/apps/settings/accounts?${new URLSearchParams(params)}`);
    const error = c.req.query("error");
    if (error) return back({ oauth: "error", provider: "microsoft", reason: c.req.query("error_description") ?? error });
    try {
      const state = readMicrosoftState(c.req.query("state") ?? "");
      const tokens = await exchangeMicrosoftCode(c.req.query("code") ?? "");
      const id = await upsertMicrosoftAccount(state.organizationId, state.userId, tokens, state.capabilities, state.accountId);
      void syncAccount(id, { force: true });
      void syncAccountCalendars(id, { force: true });
      return back({ oauth: "connected", provider: "microsoft", accountId: id });
    } catch (e) {
      logger.warn({ err: e }, "email: microsoft oauth callback failed");
      return back({ oauth: "error", provider: "microsoft", reason: (e as Error).message });
    }
  })
  .post(
    "/accounts/:id/capabilities",
    handle(async (u, c) => {
      const id = c.req.param("id") ?? "";
      const result = await setCapabilities(u.organizationId, u.userId, id, capabilitiesOf((await body(c)).capabilities));
      if (!result.needsAuth) {
        void syncAccount(id, { force: true });
        void syncAccountCalendars(id, { force: true });
      }
      return c.json(result);
    }),
  )
  .patch(
    "/accounts/:id",
    handle(async (u, c) => {
      await updateAccount(u.organizationId, u.userId, c.req.param("id") ?? "", await body(c));
      return c.json({ ok: true });
    }),
  )
  .post(
    "/accounts/:id/test",
    handle(async (u, c) => {
      try {
        await testAccount(u.organizationId, u.userId, c.req.param("id") ?? "");
        return c.json({ ok: true });
      } catch (e) {
        if (e instanceof EmailAccessError) throw e;
        return c.json({ ok: false, error: (e as Error).message });
      }
    }),
  )
  .post(
    "/accounts/:id/sync",
    handle(async (u, c) => {
      const id = c.req.param("id") ?? "";
      await requireAccountRole(u.organizationId, u.userId, id, "member");
      const account = await loadAccount(id);
      if (account.status === "error") await db.updateTable("connected_account").set({ status: "active" }).where("id", "=", id).execute();
      void syncAccount(id, { force: true });
      return c.json({ ok: true }, 202);
    }),
  )
  .post(
    "/accounts/:id/backfill/:op",
    handle(async (u, c) => {
      const op = c.req.param("op");
      if (op !== "pause" && op !== "resume") return c.json({ error: "invalid_op" }, 400);
      await setBackfillPaused(u.organizationId, u.userId, c.req.param("id") ?? "", op === "pause");
      return c.json({ ok: true });
    }),
  )
  .delete(
    "/accounts/:id",
    handle(async (u, c) => {
      await deleteAccount(u.organizationId, u.userId, c.req.param("id") ?? "", c.req.query("purgeMail") === "true");
      return c.json({ ok: true });
    }),
  )
  .post(
    "/accounts/:id/import",
    handle(async (u, c) => {
      const accountId = c.req.param("id") ?? "";
      await requireAccountRole(u.organizationId, u.userId, accountId, "owner");
      const account = await loadAccount(accountId);
      const form = await c.req.formData();
      const files = form.getAll("files").filter((f): f is File => f instanceof File);
      if (!files.length) return c.json({ error: "no_files" }, 400);
      const items = [];
      for (const f of files) {
        const raw = Buffer.from(await f.arrayBuffer());
        items.push({ providerMessageId: `import:${createHash("sha256").update(raw).digest("hex")}`, raw, isSent: false, isRead: true, internalDate: null });
      }
      const result = await ingestBatch(account, items, { backfill: false });
      return c.json(result);
    }),
  )
  .patch(
    "/accounts/:id/sharing",
    handle(async (u, c) => {
      const b = await body(c);
      if (b.visibility !== "private" && b.visibility !== "shared") return c.json({ error: "invalid_visibility" }, 400);
      await setVisibility(u.organizationId, u.userId, c.req.param("id") ?? "", b.visibility);
      return c.json({ ok: true });
    }),
  )
  .get(
    "/accounts/:id/members",
    handle(async (u, c) => c.json(await listMembers(u.organizationId, u.userId, c.req.param("id") ?? ""))),
  )
  .post(
    "/accounts/:id/members",
    handle(async (u, c) => {
      const b = await body(c);
      const role = b.role === "viewer" ? "viewer" : "member";
      await upsertMember(u.organizationId, u.userId, c.req.param("id") ?? "", String(b.userId ?? ""), role);
      return c.json({ ok: true });
    }),
  )
  .delete(
    "/accounts/:id/members/:userId",
    handle(async (u, c) => {
      await removeMember(u.organizationId, u.userId, c.req.param("id") ?? "", c.req.param("userId") ?? "");
      return c.json({ ok: true });
    }),
  )
  .get(
    "/org-users",
    handle(async (u, c) => {
      const rows = await db
        .selectFrom("member")
        .innerJoin("user", "user.id", "member.userId")
        .select(["user.id", "user.name", "user.email"])
        .where("member.organizationId", "=", u.organizationId)
        .orderBy("user.name")
        .execute();
      return c.json(rows);
    }),
  )

  // ── threads ──────────────────────────────────────────────────────────────
  .get(
    "/threads",
    handle(async (u, c) => {
      const view = (c.req.query("view") ?? "inbox") as EmailView;
      if (!EMAIL_VIEWS.includes(view)) return c.json({ error: "invalid_view" }, 400);
      return c.json(
        await listThreads({
          organizationId: u.organizationId,
          userId: u.userId,
          view,
          accountId: c.req.query("accountId") || null,
          labelId: c.req.query("labelId") || null,
          includeChildren: c.req.query("includeChildren") !== "false",
          q: c.req.query("q") || null,
          cursor: c.req.query("cursor") || undefined,
          limit: Number(c.req.query("limit") ?? 50),
        }),
      );
    }),
  )
  .get(
    "/threads/:id",
    handle(async (u, c) => c.json(await getThreadDetail(u.organizationId, u.userId, c.req.param("id") ?? ""))),
  )
  .post(
    "/threads/bulk",
    handle(async (u, c) => {
      const b = await body(c);
      const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
      const action = b.action as ThreadAction;
      if (!THREAD_ACTIONS.includes(action)) return c.json({ error: "invalid_action" }, 400);
      const touched = await applyThreadAction(u.organizationId, u.userId, ids, action, (b.payload as Record<string, never>) ?? {});
      await broadcastTouched(touched);
      if (action === "label") broadcastEmailUserEvent(u.userId, { type: "labels.updated" });
      return c.json({ ok: true });
    }),
  )
  .get(
    "/counts",
    handle(async (u, c) => c.json(await viewCounts(u.organizationId, u.userId, c.req.query("accountId") || null))),
  )
  .delete(
    "/trash",
    handle(async (u, c) => {
      await broadcastTouched(await purgeView(u.organizationId, u.userId, "trash", c.req.query("accountId") || null));
      return c.json({ ok: true });
    }),
  )
  .delete(
    "/spam",
    handle(async (u, c) => {
      await broadcastTouched(await purgeView(u.organizationId, u.userId, "spam", c.req.query("accountId") || null));
      return c.json({ ok: true });
    }),
  )

  // ── messages ─────────────────────────────────────────────────────────────
  .patch(
    "/messages/:id",
    handle(async (u, c) => {
      const message = await requireMessage(u.organizationId, u.userId, c.req.param("id") ?? "", "member");
      const b = await body(c);
      await setMessageFlags(message.id, { isRead: b.isRead as boolean | undefined, isStarred: b.isStarred as boolean | undefined });
      await recomputeThread(message.threadId);
      await messageTouched(message.id);
      return c.json({ ok: true });
    }),
  )
  .delete(
    "/messages/:id",
    handle(async (u, c) => {
      const message = await requireMessage(u.organizationId, u.userId, c.req.param("id") ?? "", "member");
      await softDeleteMessage(message.id, u.userId, true);
      await recomputeThread(message.threadId);
      await messageTouched(message.id);
      return c.json({ ok: true });
    }),
  )
  .post(
    "/messages/:id/restore",
    handle(async (u, c) => {
      const message = await requireMessage(u.organizationId, u.userId, c.req.param("id") ?? "", "member");
      await softDeleteMessage(message.id, u.userId, false);
      await recomputeThread(message.threadId);
      await messageTouched(message.id);
      return c.json({ ok: true });
    }),
  )
  .post(
    "/messages/:id/purge",
    handle(async (u, c) => {
      const message = await requireMessage(u.organizationId, u.userId, c.req.param("id") ?? "", "member");
      if (!message.deletedAt) return c.json({ error: "not_in_trash" }, 400);
      await purgeMessages([message.id]);
      await recomputeThread(message.threadId);
      await messageTouched(message.id);
      return c.json({ ok: true });
    }),
  )
  .get(
    "/messages/:id/raw",
    handle(async (u, c) => {
      const message = await requireMessage(u.organizationId, u.userId, c.req.param("id") ?? "");
      if (!message.rawMediaId) return c.json({ error: "raw_not_available" }, 404);
      const media = await readEmailMedia(u.organizationId, message.rawMediaId);
      const name = `${(message.subject || "message").replace(/[^\w\- ]+/g, "").slice(0, 60) || "message"}.eml`;
      return c.body(new Uint8Array(media.body), 200, { "content-type": "message/rfc822", "content-disposition": `attachment; filename="${name}"` });
    }),
  )
  .post(
    "/messages/:id/cancel",
    handle(async (u, c) => {
      const message = await cancelSend(u.organizationId, u.userId, c.req.param("id") ?? "");
      await messageTouched(message.id);
      return c.json({ ok: true });
    }),
  )
  .post(
    "/messages/:id/retry",
    handle(async (u, c) => {
      const message = await retrySend(u.organizationId, u.userId, c.req.param("id") ?? "");
      await messageTouched(message.id);
      return c.json({ ok: true });
    }),
  )

  // ── drafts ───────────────────────────────────────────────────────────────
  .post(
    "/drafts",
    handle(async (u, c) => {
      const b = await body(c);
      const kind = (["new", "reply", "reply_all", "forward"].includes(String(b.composeKind)) ? b.composeKind : "new") as ComposeKind;
      const id = await createDraft(u.organizationId, u.userId, {
        composeKind: kind,
        sourceMessageId: typeof b.sourceMessageId === "string" ? b.sourceMessageId : null,
        accountId: typeof b.accountId === "string" ? b.accountId : null,
      });
      await messageTouched(id);
      const row = await db.selectFrom("email_message").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
      return c.json((await serializeMessages([row]))[0], 201);
    }),
  )
  .get(
    "/drafts/:id",
    handle(async (u, c) => {
      const message = await requireMessage(u.organizationId, u.userId, c.req.param("id") ?? "");
      return c.json((await serializeMessages([message]))[0]);
    }),
  )
  .patch(
    "/drafts/:id",
    handle(async (u, c) => {
      const id = c.req.param("id") ?? "";
      const result = await updateDraft(u.organizationId, u.userId, id, await body(c));
      await messageTouched(id);
      return c.json(result);
    }),
  )
  .delete(
    "/drafts/:id",
    handle(async (u, c) => {
      const draft = await discardDraft(u.organizationId, u.userId, c.req.param("id") ?? "");
      await broadcastEmailEvent(draft.accountId, { type: "thread.updated", accountId: draft.accountId, threadIds: [draft.threadId] });
      return c.json({ ok: true });
    }),
  )
  .post(
    "/drafts/:id/attachments",
    handle(async (u, c) => {
      const form = await c.req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return c.json({ error: "file_required" }, 400);
      if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "file_too_large" }, 413);
      const result = await addDraftAttachment(u.organizationId, u.userId, c.req.param("id") ?? "", {
        filename: file.name || "attachment",
        contentType: file.type || null,
        data: Buffer.from(await file.arrayBuffer()),
        inline: form.get("inline") === "true",
      });
      return c.json(result, 201);
    }),
  )
  .delete(
    "/drafts/:id/attachments/:attachmentId",
    handle(async (u, c) => {
      await removeDraftAttachment(u.organizationId, u.userId, c.req.param("id") ?? "", c.req.param("attachmentId") ?? "");
      return c.json({ ok: true });
    }),
  )
  .post(
    "/drafts/:id/send",
    handle(async (u, c) => {
      const b = await body(c);
      const draft = await sendDraft(u.organizationId, u.userId, c.req.param("id") ?? "", {
        scheduledAt: typeof b.scheduledAt === "string" ? b.scheduledAt : null,
        undoSeconds: typeof b.undoSeconds === "number" ? b.undoSeconds : undefined,
      });
      await messageTouched(draft.id);
      const row = await db.selectFrom("email_message").selectAll().where("id", "=", draft.id).executeTakeFirstOrThrow();
      return c.json((await serializeMessages([row]))[0]);
    }),
  )

  // ── attachments ──────────────────────────────────────────────────────────
  .get(
    "/attachments/:id",
    handle(async (u, c) => {
      const att = await db
        .selectFrom("email_attachment")
        .selectAll()
        .where("id", "=", c.req.param("id") ?? "")
        .where("organizationId", "=", u.organizationId)
        .executeTakeFirst();
      if (!att) return c.json({ error: "attachment_not_found" }, 404);
      await requireMessage(u.organizationId, u.userId, att.messageId);
      if (!att.mediaId) return c.json({ error: "attachment_not_stored", status: att.status }, 404);
      const media = await readEmailMedia(u.organizationId, att.mediaId);
      const type = att.contentType ?? media.contentType;
      const inline = c.req.query("inline") === "1" && INLINE_SAFE.has(type);
      const filename = att.filename.replace(/["\r\n\\]/g, "");
      return c.body(new Uint8Array(media.body), 200, {
        "content-type": inline ? type : type === "text/html" || type === "image/svg+xml" ? "application/octet-stream" : type,
        "content-disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
        "x-content-type-options": "nosniff",
        "cache-control": "private, max-age=86400",
      });
    }),
  )

  // ── labels ───────────────────────────────────────────────────────────────
  .get(
    "/labels",
    handle(async (u, c) => c.json(await listLabels(u.organizationId, u.userId))),
  )
  .post(
    "/labels",
    handle(async (u, c) => {
      const b = await body(c);
      const id = await createLabel(u.organizationId, u.userId, {
        name: b.name,
        parentId: typeof b.parentId === "string" ? b.parentId : null,
        accountId: typeof b.accountId === "string" ? b.accountId : null,
        color: typeof b.color === "string" ? b.color : null,
      });
      broadcastEmailUserEvent(u.userId, { type: "labels.updated" });
      return c.json({ id }, 201);
    }),
  )
  .patch(
    "/labels/:id",
    handle(async (u, c) => {
      const b = await body(c);
      await updateLabel(u.organizationId, u.userId, c.req.param("id") ?? "", {
        name: b.name,
        color: b.color === undefined ? undefined : (b.color as string | null),
        parentId: b.parentId === undefined ? undefined : (b.parentId as string | null),
        position: typeof b.position === "number" ? b.position : undefined,
      });
      broadcastEmailUserEvent(u.userId, { type: "labels.updated" });
      return c.json({ ok: true });
    }),
  )
  .delete(
    "/labels/:id",
    handle(async (u, c) => {
      await deleteLabel(u.organizationId, u.userId, c.req.param("id") ?? "", c.req.query("children") === "reparent" ? "reparent" : "delete");
      broadcastEmailUserEvent(u.userId, { type: "labels.updated" });
      return c.json({ ok: true });
    }),
  )

  // ── sender rules ─────────────────────────────────────────────────────────
  .get(
    "/sender-rules",
    handle(async (u, c) => {
      const rows = await db
        .selectFrom("email_sender_rule")
        .selectAll()
        .where("organizationId", "=", u.organizationId)
        .where("ownerUserId", "=", u.userId)
        .orderBy("createdAt", "desc")
        .execute();
      return c.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
    }),
  )
  .delete(
    "/sender-rules/:id",
    handle(async (u, c) => {
      await db
        .deleteFrom("email_sender_rule")
        .where("id", "=", c.req.param("id") ?? "")
        .where("ownerUserId", "=", u.userId)
        .execute();
      return c.json({ ok: true });
    }),
  );
