import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { logger } from "../../logger";
import { EmailAuthError, type BackfillStep, type EmailAccountRow, type EmailConnector, type RawIncoming, type SyncContext } from "../types";

// Generic IMAP (inbound) + SMTP (outbound). Head sync walks UIDs upward from
// lastUid per mailbox; backfill walks downward from lowestUid in batches.
// A UIDVALIDITY change resets that mailbox — dedupe makes the rescan safe.

interface ImapConfig {
  username?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  appendToSent?: boolean;
}

interface MailboxCursor {
  uidValidity: string;
  lastUid: number;
}

interface MailboxTail {
  uidValidity: string;
  lowestUid: number;
}

const HEAD_BATCH = 200;
const BACKFILL_BATCH = 100;

function cfg(account: Pick<EmailAccountRow, "address" | "config">): Required<Omit<ImapConfig, "appendToSent">> & { appendToSent: boolean } {
  const c = account.config as ImapConfig;
  if (!c.imapHost || !c.smtpHost) throw new Error("imap_smtp_hosts_required");
  return {
    username: c.username || account.address,
    imapHost: c.imapHost,
    imapPort: Number(c.imapPort ?? 993),
    imapSecure: c.imapSecure ?? true,
    smtpHost: c.smtpHost,
    smtpPort: Number(c.smtpPort ?? 465),
    smtpSecure: c.smtpSecure ?? Number(c.smtpPort ?? 465) === 465,
    appendToSent: c.appendToSent ?? false,
  };
}

function isAuthFailure(e: unknown): boolean {
  const err = e as { authenticationFailed?: boolean; responseCode?: number; code?: string; message?: string };
  return (
    !!err?.authenticationFailed ||
    err?.code === "EAUTH" ||
    err?.responseCode === 535 ||
    (/auth/i.test(err?.message ?? "") && /fail|invalid/i.test(err?.message ?? ""))
  );
}

async function withImap<T>(
  account: Pick<EmailAccountRow, "address" | "config">,
  credentials: Record<string, unknown>,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const c = cfg(account);
  const client = new ImapFlow({
    host: c.imapHost,
    port: c.imapPort,
    secure: c.imapSecure,
    auth: { user: c.username, pass: String(credentials.password ?? "") },
    logger: false,
    socketTimeout: 120_000,
  });
  client.on("error", (err: unknown) => logger.warn({ err, host: c.imapHost }, "email: imap socket error"));
  try {
    await client.connect();
  } catch (e) {
    if (isAuthFailure(e)) throw new EmailAuthError("imap_auth_failed");
    throw e;
  }
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

async function syncMailboxes(client: ImapFlow): Promise<{ path: string; isSent: boolean }[]> {
  const list = await client.list();
  const sent = list.find((m) => m.specialUse === "\\Sent");
  return [{ path: "INBOX", isSent: false }, ...(sent ? [{ path: sent.path, isSent: true }] : [])];
}

function providerId(mailbox: string, uidValidity: string, uid: number) {
  return `imap:${mailbox}:${uidValidity}:${uid}`;
}

async function fetchRaw(client: ImapFlow, mailbox: string, uidValidity: string, uids: number[], isSent: boolean): Promise<RawIncoming[]> {
  if (!uids.length) return [];
  const out: RawIncoming[] = [];
  for await (const msg of client.fetch(uids.join(","), { uid: true, source: true, flags: true, internalDate: true }, { uid: true })) {
    if (!msg.source) continue;
    out.push({
      providerMessageId: providerId(mailbox, uidValidity, msg.uid),
      raw: msg.source,
      isSent,
      isRead: msg.flags?.has("\\Seen") ?? false,
      internalDate: msg.internalDate ? new Date(msg.internalDate) : null,
    });
  }
  return out;
}

export const imapSmtpConnector: EmailConnector = {
  kind: "imap",

  async verify(account, credentials) {
    await withImap(account, credentials, async (client) => {
      await client.mailboxOpen("INBOX", { readOnly: true });
    });
    const c = cfg(account);
    const transport = nodemailer.createTransport({
      host: c.smtpHost,
      port: c.smtpPort,
      secure: c.smtpSecure,
      auth: { user: c.username, pass: String(credentials.password ?? "") },
    });
    try {
      await transport.verify();
    } catch (e) {
      if (isAuthFailure(e)) throw new EmailAuthError("smtp_auth_failed");
      throw e;
    } finally {
      transport.close();
    }
  },

  async pullHead(ctx: SyncContext) {
    return withImap(ctx.account, ctx.credentials, async (client) => {
      const cursor = { ...(ctx.account.syncCursor as Record<string, MailboxCursor>) };
      const tail = { ...((ctx.account.backfillCursor ?? {}) as Record<string, MailboxTail>) };
      let tailChanged = false;
      let total = 0;
      for (const mb of await syncMailboxes(client)) {
        const lock = await client.getMailboxLock(mb.path, { readOnly: true });
        try {
          const mailbox = client.mailbox;
          if (!mailbox) continue;
          const uidValidity = String(mailbox.uidValidity);
          const uidNext = Number(mailbox.uidNext ?? 1);
          total += mailbox.exists ?? 0;
          const prev = cursor[mb.path];
          if (!prev || prev.uidValidity !== uidValidity) {
            cursor[mb.path] = { uidValidity, lastUid: uidNext - 1 };
            tail[mb.path] = { uidValidity, lowestUid: uidNext };
            tailChanged = true;
            continue;
          }
          if (uidNext - 1 <= prev.lastUid) continue;
          const found = await client.search({ uid: `${prev.lastUid + 1}:*` }, { uid: true });
          const uids = (found || []).filter((u) => u > prev.lastUid).sort((a, b) => a - b);
          for (let i = 0; i < uids.length; i += HEAD_BATCH) {
            const batch = uids.slice(i, i + HEAD_BATCH);
            await ctx.ingest(await fetchRaw(client, mb.path, uidValidity, batch, mb.isSent));
            cursor[mb.path] = { uidValidity, lastUid: batch[batch.length - 1] };
          }
        } finally {
          lock.release();
        }
      }
      return { cursor, ...(tailChanged ? { backfillCursor: tail, total } : {}) };
    });
  },

  async pullBackfill(ctx: SyncContext): Promise<BackfillStep> {
    return withImap(ctx.account, ctx.credentials, async (client) => {
      const tail = { ...((ctx.account.backfillCursor ?? {}) as Record<string, MailboxTail>) };
      const progress = ctx.account.backfillProgress as { done?: number; total?: number };
      let done = progress.done ?? 0;
      for (const mb of await syncMailboxes(client)) {
        const t = tail[mb.path];
        if (!t || t.lowestUid <= 1) continue;
        const lock = await client.getMailboxLock(mb.path, { readOnly: true });
        try {
          const mailbox = client.mailbox;
          if (!mailbox) continue;
          const uidValidity = String(mailbox.uidValidity);
          if (uidValidity !== t.uidValidity) {
            tail[mb.path] = { uidValidity, lowestUid: Number(mailbox.uidNext ?? 1) };
            return { cursor: tail, done, total: progress.total ?? null };
          }
          const found = await client.search({ uid: `1:${t.lowestUid - 1}` }, { uid: true });
          const uids = (found || []).filter((u) => u < t.lowestUid).sort((a, b) => a - b);
          if (!uids.length) {
            tail[mb.path] = { uidValidity, lowestUid: 1 };
            continue;
          }
          const batch = uids.slice(-BACKFILL_BATCH);
          const fresh = new Set(await ctx.filterNew(batch.map((u) => providerId(mb.path, uidValidity, u))));
          const wanted = batch.filter((u) => fresh.has(providerId(mb.path, uidValidity, u)));
          await ctx.ingest(await fetchRaw(client, mb.path, uidValidity, wanted, mb.isSent));
          done += batch.length;
          tail[mb.path] = { uidValidity, lowestUid: batch[0] };
          return { cursor: tail, done, total: progress.total ?? null };
        } finally {
          lock.release();
        }
      }
      return { cursor: null, done, total: progress.total ?? done };
    });
  },

  async send(ctx, mime, envelope) {
    const c = cfg(ctx.account);
    const transport = nodemailer.createTransport({
      host: c.smtpHost,
      port: c.smtpPort,
      secure: c.smtpSecure,
      auth: { user: c.username, pass: String(ctx.credentials.password ?? "") },
    });
    try {
      await transport.sendMail({ envelope: { from: envelope.from, to: envelope.to }, raw: mime });
    } catch (e) {
      if (isAuthFailure(e)) throw new EmailAuthError("smtp_auth_failed");
      throw e;
    } finally {
      transport.close();
    }
    if (c.appendToSent) {
      await withImap(ctx.account, ctx.credentials, async (client) => {
        const sent = (await syncMailboxes(client)).find((m) => m.isSent);
        if (sent) await client.append(sent.path, mime, ["\\Seen"]);
      }).catch((e) => logger.warn({ err: e, accountId: ctx.account.id }, "email: append to Sent failed"));
    }
    return {};
  },
};
