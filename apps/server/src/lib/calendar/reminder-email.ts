import { db } from "../../auth";
import { logger } from "../logger";
import { createDraft, sendDraft, updateDraft } from "../email/compose";

// Email reminders go to the user's own address through their first mail
// account (the normal outbox, no undo window).

function escape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendReminderEmail(
  userId: string,
  organizationId: string,
  payload: { title: string; location?: string | null; conferenceUrl?: string | null; occurrenceStart: string; minutes: number },
) {
  const account = await db
    .selectFrom("connected_account")
    .innerJoin("connected_account_member", "connected_account_member.accountId", "connected_account.id")
    .select(["connected_account.id", "connected_account.address"])
    .where("connected_account_member.userId", "=", userId)
    .where("connected_account_member.role", "=", "owner")
    .where("connected_account.organizationId", "=", organizationId)
    .where("connected_account.deletedAt", "is", null)
    .where((eb) => eb(eb.val("mail"), "=", eb.fn.any("connected_account.capabilities")))
    .orderBy("connected_account.createdAt")
    .executeTakeFirst();
  if (!account) {
    logger.info({ userId }, "calendar: no mail account for email reminder");
    return;
  }
  const when = new Date(payload.occurrenceStart).toUTCString();
  const draftId = await createDraft(organizationId, userId, {
    accountId: account.id,
    to: [{ name: null, address: account.address }],
    subject: `Reminder: ${payload.title}`,
  });
  await updateDraft(organizationId, userId, draftId, {
    bodyHtml: `<p><strong>${escape(payload.title)}</strong></p><p>${escape(when)}${payload.location ? `<br>${escape(payload.location)}` : ""}</p>${payload.conferenceUrl ? `<p><a href="${escape(payload.conferenceUrl)}">Join video call</a></p>` : ""}`,
  });
  await sendDraft(organizationId, userId, draftId, { undoSeconds: 0 });
}
