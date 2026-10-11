import { db } from "../../auth";
import type { EmailAddress } from "../../plugins/db";

const PREFIX_RE = /^\s*((re|fw|fwd|aw|sv|antw|wg|tr|rif)(\[\d+\])?\s*:\s*)+/i;
const GENERIC_SUBJECTS = new Set(["", "hi", "hello", "hey", "test", "question", "update", "info", "fyi", "(no subject)", "no subject", "thanks"]);
const SUBJECT_FALLBACK_DAYS = 14;

export function normalizeSubject(subject: string): string {
  return subject.replace(PREFIX_RE, "").replace(/\s+/g, " ").trim();
}

export function prefixedSubject(subject: string, prefix: "Re" | "Fwd"): string {
  const re = prefix === "Re" ? /^\s*re\s*:/i : /^\s*(fwd?|fw)\s*:/i;
  return re.test(subject) ? subject : `${prefix}: ${subject}`;
}

export interface ThreadHints {
  accountId: string;
  inReplyTo: string | null;
  references: string[];
  providerThreadId: string | null;
  subject: string;
  participants: EmailAddress[];
}

/**
 * Finds the local thread a message belongs to: References/In-Reply-To first,
 * then the provider thread id, then a guarded subject + participant match for
 * clients that drop headers. Messages linking several threads merge them.
 */
export async function findThread(hints: ThreadHints): Promise<string | null> {
  const ids = [...new Set([hints.inReplyTo, ...hints.references].filter((v): v is string => !!v))];
  if (ids.length) {
    const rows = await db
      .selectFrom("email_message")
      .innerJoin("email_thread", "email_thread.id", "email_message.threadId")
      .select(["email_message.threadId", "email_thread.createdAt"])
      .where("email_message.accountId", "=", hints.accountId)
      .where("email_message.rfcMessageId", "in", ids)
      .where("email_thread.purgedAt", "is", null)
      .orderBy("email_thread.createdAt", "asc")
      .execute();
    const threadIds = [...new Set(rows.map((r) => r.threadId))];
    if (threadIds.length) {
      const [keep, ...rest] = threadIds;
      if (rest.length) await mergeThreads(keep, rest);
      return keep;
    }
  }

  if (hints.providerThreadId) {
    const row = await db
      .selectFrom("email_thread")
      .select("id")
      .where("accountId", "=", hints.accountId)
      .where("providerThreadId", "=", hints.providerThreadId)
      .where("purgedAt", "is", null)
      .executeTakeFirst();
    if (row) return row.id;
  }

  const subject = normalizeSubject(hints.subject);
  if (!ids.length && subject.length >= 4 && !GENERIC_SUBJECTS.has(subject.toLowerCase())) {
    const since = new Date(Date.now() - SUBJECT_FALLBACK_DAYS * 86_400_000);
    const candidates = await db
      .selectFrom("email_thread")
      .select(["id", "participants"])
      .where("accountId", "=", hints.accountId)
      .where("subject", "=", subject)
      .where("lastMessageAt", ">=", since)
      .where("purgedAt", "is", null)
      .orderBy("lastMessageAt", "desc")
      .limit(5)
      .execute();
    const mine = new Set(hints.participants.map((p) => p.address));
    const match = candidates.find((t) => t.participants.some((p) => mine.has(p.address)));
    if (match) return match.id;
  }
  return null;
}

/** Moves messages + labels of `others` into `keep` and drops the emptied threads. */
export async function mergeThreads(keep: string, others: string[]) {
  if (!others.length) return;
  await db.transaction().execute(async (trx) => {
    await trx.updateTable("email_message").set({ threadId: keep }).where("threadId", "in", others).execute();
    const labels = await trx.selectFrom("email_thread_label").selectAll().where("threadId", "in", others).execute();
    for (const l of labels) {
      await trx
        .insertInto("email_thread_label")
        .values({ threadId: keep, labelId: l.labelId, addedByUserId: l.addedByUserId, createdAt: l.createdAt })
        .onConflict((oc) => oc.columns(["threadId", "labelId"]).doNothing())
        .execute();
    }
    await trx.deleteFrom("email_thread").where("id", "in", others).execute();
  });
}
