import { createHash } from "node:crypto";
import { simpleParser, type AddressObject } from "mailparser";
import type { EmailAddress } from "../../plugins/db";

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  contentId: string | null;
  isInline: boolean;
}

export interface NormalizedMessage {
  rfcMessageId: string;
  inReplyTo: string | null;
  references: string[];
  from: EmailAddress | null;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  replyTo: EmailAddress[];
  subject: string;
  date: Date | null;
  text: string | null;
  html: string | null;
  snippet: string;
  headers: Record<string, string>;
  attachments: ParsedAttachment[];
}

const KEPT_HEADERS = ["list-unsubscribe", "list-unsubscribe-post", "list-id", "auto-submitted", "precedence", "x-auto-response-suppress"];

const MESSAGE_ID_RE = /<[^<>\s]+>/g;

/** "<a@b>" form; bare ids get brackets. */
export function normalizeMessageId(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(MESSAGE_ID_RE);
  if (match?.[0]) return match[0].toLowerCase();
  const bare = value.trim();
  return bare ? `<${bare.replace(/[<>]/g, "")}>`.toLowerCase() : null;
}

export function messageIdList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  const joined = Array.isArray(value) ? value.join(" ") : value;
  return [...new Set((joined.match(MESSAGE_ID_RE) ?? []).map((v) => v.toLowerCase()))];
}

function addresses(value: AddressObject | AddressObject[] | undefined): EmailAddress[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  const out: EmailAddress[] = [];
  for (const obj of list) {
    for (const entry of obj.value) {
      if (entry.address) out.push({ name: entry.name || null, address: entry.address.toLowerCase() });
      for (const member of entry.group ?? []) {
        if (member.address) out.push({ name: member.name || null, address: member.address.toLowerCase() });
      }
    }
  }
  return out;
}

export function makeSnippet(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseRaw(raw: Buffer): Promise<NormalizedMessage> {
  const mail = await simpleParser(raw, { keepCidLinks: true, skipTextToHtml: true });
  const headers: Record<string, string> = {};
  for (const line of mail.headerLines) {
    if (KEPT_HEADERS.includes(line.key)) headers[line.key] = line.line.slice(line.line.indexOf(":") + 1).trim();
  }
  const html = typeof mail.html === "string" && mail.html.trim() ? mail.html : null;
  const text = mail.text?.trim() ? mail.text : html ? htmlToText(html) : null;
  const rfcMessageId = normalizeMessageId(mail.messageId) ?? `<${createHash("sha256").update(raw).digest("hex").slice(0, 32)}@twodb.local>`;
  const from = addresses(mail.from)[0] ?? null;

  return {
    rfcMessageId,
    inReplyTo: normalizeMessageId(mail.inReplyTo),
    references: messageIdList(mail.references),
    from,
    to: addresses(mail.to),
    cc: addresses(mail.cc),
    bcc: addresses(mail.bcc),
    replyTo: addresses(mail.replyTo),
    subject: (mail.subject ?? "").trim(),
    date: mail.date && !Number.isNaN(mail.date.getTime()) ? mail.date : null,
    text,
    html,
    snippet: makeSnippet(text),
    headers,
    attachments: mail.attachments.map((a, i) => ({
      filename: a.filename || `attachment-${i + 1}${a.contentType === "message/rfc822" ? ".eml" : ""}`,
      contentType: a.contentType || "application/octet-stream",
      size: a.size ?? a.content.length,
      content: a.content as Buffer,
      contentId: a.contentId ? a.contentId.replace(/[<>]/g, "") : null,
      isInline: a.contentDisposition === "inline" && !!a.contentId,
    })),
  };
}
