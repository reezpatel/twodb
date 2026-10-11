import MailComposer from "nodemailer/lib/mail-composer";
import type { Selectable } from "kysely";
import { db } from "../../auth";
import type { EmailAddress, EmailMessageTable } from "../../plugins/db";
import { htmlToText } from "./parse";
import { readEmailMedia } from "./storage";
import type { EmailAccountRow } from "./types";

type MessageRow = Selectable<EmailMessageTable>;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatAddress(a: EmailAddress | null): string {
  if (!a) return "";
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

function formatDate(d: Date): string {
  return d.toUTCString().replace(" GMT", " UTC");
}

function sourceBodyHtml(source: MessageRow): string {
  if (source.bodyHtml) return source.bodyHtml;
  return escapeHtml(source.bodyText ?? "").replace(/\n/g, "<br>");
}

/** Quote block appended at send time — the draft body only holds what the user wrote. */
export function quoteFor(kind: string | null, source: MessageRow): { html: string; text: string } {
  const from = source.fromAddress ? { name: source.fromName, address: source.fromAddress } : null;
  const when = source.sentAt ?? source.receivedAt ?? source.createdAt;
  const sourceText = source.bodyText ?? (source.bodyHtml ? htmlToText(source.bodyHtml) : "");
  if (kind === "forward") {
    const header = [
      "---------- Forwarded message ---------",
      `From: ${formatAddress(from)}`,
      `Date: ${formatDate(when)}`,
      `Subject: ${source.subject}`,
      `To: ${source.to.map(formatAddress).join(", ")}`,
      ...(source.cc.length ? [`Cc: ${source.cc.map(formatAddress).join(", ")}`] : []),
    ];
    return {
      html: `<br><div class="twodb_quote">${header.map(escapeHtml).join("<br>")}<br><br>${sourceBodyHtml(source)}</div>`,
      text: `\n\n${header.join("\n")}\n\n${sourceText}`,
    };
  }
  const intro = `On ${formatDate(when)}, ${formatAddress(from)} wrote:`;
  return {
    html: `<br><div class="twodb_quote"><div>${escapeHtml(intro)}</div><blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${sourceBodyHtml(source)}</blockquote></div>`,
    text: `\n\n${intro}\n${sourceText
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n")}`,
  };
}

const toMime = (list: EmailAddress[]) => list.map((a) => ({ name: a.name ?? "", address: a.address }));

/** Builds the exact RFC822 bytes we send and archive. keepBcc is for Gmail, which reads recipients from headers. */
export async function buildMime(message: MessageRow, account: EmailAccountRow, opts: { keepBcc: boolean }): Promise<{ mime: Buffer; envelope: { from: string; to: string[] } }> {
  let html = message.bodyHtml ?? "";
  let text = html ? htmlToText(html) : (message.bodyText ?? "");
  if (message.sourceMessageId && message.headers["x-twodb-include-quote"] !== "0") {
    const source = await db.selectFrom("email_message").selectAll().where("id", "=", message.sourceMessageId).executeTakeFirst();
    if (source && !source.purgedAt) {
      const quote = quoteFor(message.composeKind, source);
      html += quote.html;
      text += quote.text;
    }
  }

  const attachments = await db.selectFrom("email_attachment").selectAll().where("messageId", "=", message.id).execute();
  const parts = [];
  for (const a of attachments) {
    if (!a.mediaId) continue;
    const media = await readEmailMedia(message.organizationId, a.mediaId);
    parts.push({ filename: a.filename, content: media.body, contentType: a.contentType ?? undefined, ...(a.isInline && a.contentId ? { cid: a.contentId } : {}) });
  }

  const fromAddress = message.fromAddress ?? account.address;
  const composer = new MailComposer({
    from: { name: message.fromName ?? account.displayName ?? "", address: fromAddress },
    to: toMime(message.to),
    cc: toMime(message.cc),
    bcc: toMime(message.bcc),
    subject: message.subject,
    messageId: message.rfcMessageId ?? undefined,
    date: new Date(),
    inReplyTo: message.inReplyTo ?? undefined,
    references: message.references.length ? message.references : undefined,
    html: html || undefined,
    text,
    attachments: parts,
    xMailer: "twodb",
  });
  const node = composer.compile();
  node.keepBcc = opts.keepBcc;
  const mime = await node.build();
  const recipients = [...message.to, ...message.cc, ...message.bcc].map((a) => a.address);
  return { mime, envelope: { from: fromAddress, to: [...new Set(recipients)] } };
}
