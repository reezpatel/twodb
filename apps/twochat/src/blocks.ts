import { z } from "zod";

/**
 * Message content model. A message is `blocks` (composed building blocks) with
 * a plain-text `text` fallback for notifications/search/CLI. Bots and agents
 * compose blocks; humans get plain text (with a divider-free layout block
 * wrapping on render, not on write).
 *
 * This block vocabulary is the contract agents POST to twochat.bots.webhook —
 * it's what lets an agent "participate" in chat with richer UI than text.
 */

// --- Shared bits -----------------------------------------------------------

export const blockTextStyles = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  strike: z.boolean().optional(),
  code: z.boolean().optional(),
});

export const blockTextObject = z.object({
  /** The text itself. `code: true` for inline code. */
  text: z.string(),
  styles: blockTextStyles.optional(),
});

/** @mention of a user, bot, or channel — resolved at render time by the client. */
export const blockMention = z.object({
  kind: z.enum(["user", "bot", "channel"]),
  /** Actor id (user/bot) or channel id. */
  id: z.string(),
  /** Client-side fallback label while resolving / for unknown ids. */
  label: z.string().optional(),
});

const markdownBlock = z.object({
  type: z.literal("markdown"),
  /** GitHub-flavored-ish markdown rendered with react-markdown. */
  text: z.string(),
});

const dividerBlock = z.object({ type: z.literal("divider") });

const imageBlock = z.object({
  type: z.literal("image"),
  /** URL — either a twochat attachment URL or any external image URL. */
  url: z.string(),
  alt: z.string().optional(),
  title: z.string().optional(),
  /** Rendered width hint in px (capped by the client). */
  width: z.number().int().positive().max(1200).optional(),
});

const buttonStyle = z.object({
  tone: z.enum(["default", "primary", "danger"]).optional(),
  /** When false the button stays visible but inert (already-used state). */
  disabled: z.boolean().optional(),
});

const buttonBlock = z.object({
  type: z.literal("button"),
  actionId: z.string().min(1),
  text: z.string(),
  style: buttonStyle.optional(),
  /** Optional value echoed back on click (never a URL). */
  value: z.string().optional(),
  confirm: z
    .object({
      title: z.string().optional(),
      text: z.string(),
      confirmText: z.string().default("Confirm"),
      denyText: z.string().default("Cancel"),
      tone: z.enum(["default", "danger"]).optional(),
    })
    .optional(),
});

const linkButtonBlock = z.object({
  type: z.literal("link-button"),
  text: z.string(),
  url: z.string(),
  style: buttonStyle.optional(),
});

const actionsBlock = z.object({
  /** Horizontally-laid-out interactive elements (buttons for now). */
  type: z.literal("actions"),
  elements: z.array(buttonBlock).min(1).max(5),
});

/** Open-ended key/value context rows — status lines, config summaries, etc. */
const fieldBlock = z.object({
  type: z.literal("field"),
  label: z.string(),
  value: z.string(),
  short: z.boolean().optional(),
});

const contextBlock = z.object({
  type: z.literal("context"),
  /** Mixed text/mention inline elements. */
  elements: z.array(blockTextObject.merge(z.object({ mention: blockMention.optional() }))).min(1),
});

/** Attachment reference (file uploaded through twochat, or external link). */
const attachmentBlock = z.object({
  type: z.literal("attachment"),
  /** twochat asset id (uploaded via POST /channels/:id/assets). */
  assetId: z.string(),
  filename: z.string(),
  contentType: z.string().nullable().optional(),
  size: z.number().int().nonnegative().optional(),
});

/** Link preview card (legacy chat's meta.linkCard, promoted to a block). */
const linkCardBlock = z.object({
  type: z.literal("link-card"),
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
});

/** Quote/citation block for agent answers with sources. */
const quoteBlock = z.object({
  type: z.literal("quote"),
  text: z.string(),
  cite: z.string().optional(),
  url: z.string().optional(),
});

/** Typed status strip (agent run state, deploy states, health). */
const statusBlock = z.object({
  type: z.literal("status"),
  state: z.enum(["info", "success", "warning", "error", "loading"]),
  text: z.string(),
});

const codeBlock = z.object({
  type: z.literal("code"),
  code: z.string(),
  language: z.string().optional(),
  filename: z.string().optional(),
});

const taskListBlock = z.object({
  type: z.literal("task-list"),
  title: z.string().optional(),
  tasks: z.array(z.object({ text: z.string(), done: z.boolean() })).min(1),
});

const calloutBlock = z.object({
  type: z.literal("callout"),
  tone: z.enum(["info", "success", "warning", "danger"]).default("info"),
  title: z.string().optional(),
  text: z.string(),
});

export const messageBlock = z.discriminatedUnion("type", [
  markdownBlock,
  dividerBlock,
  imageBlock,
  actionsBlock,
  linkButtonBlock,
  fieldBlock,
  contextBlock,
  attachmentBlock,
  linkCardBlock,
  quoteBlock,
  statusBlock,
  codeBlock,
  taskListBlock,
  calloutBlock,
]);

export const messageBlocks = z.array(messageBlock).max(50);

export type MessageBlock = z.infer<typeof messageBlock>;
export type BlockTextObject = z.infer<typeof blockTextObject>;
export type BlockMention = z.infer<typeof blockMention>;
export type ButtonBlock = z.infer<typeof buttonBlock>;
export type FieldBlock = z.infer<typeof fieldBlock>;

// --- Block helpers (agent-facing ergonomics) --------------------------------

/** Compose blocks from a mixed list of strings (markdown) and block objects. */
export function blocks(...parts: Array<string | MessageBlock>): MessageBlock[] {
  return parts.map((p) => (typeof p === "string" ? { type: "markdown", text: p } : p));
}

/** Plain-text projection of blocks — used for the text fallback column. */
export function blocksToText(input: MessageBlock[]): string {
  const out: string[] = [];
  for (const b of input) {
    switch (b.type) {
      case "markdown":
        out.push(b.text);
        break;
      case "divider":
        out.push("—");
        break;
      case "image":
        out.push(b.alt ?? b.title ?? b.url);
        break;
      case "actions":
        out.push(b.elements.map((e) => `[${e.text}]`).join(" "));
        break;
      case "link-button":
        out.push(`[${b.text}](${b.url})`);
        break;
      case "field":
        out.push(`${b.label}: ${b.value}`);
        break;
      case "context":
        out.push(b.elements.map((e) => (e.mention ? `@${e.mention.label ?? e.mention.id}` : e.text)).join(" "));
        break;
      case "attachment":
        out.push(`📎 ${b.filename}`);
        break;
      case "link-card":
        out.push(b.title ? `${b.title} (${b.url})` : b.url);
        break;
      case "quote":
        out.push(`> ${b.text}`);
        break;
      case "status":
        out.push(b.text);
        break;
      case "code":
        out.push(b.filename ? `${b.filename}: ${b.code}` : b.code);
        break;
      case "task-list":
        out.push(b.tasks.map((t) => `${t.done ? "☑" : "☐"} ${t.text}`).join(" · "));
        break;
      case "callout":
        out.push(`${b.title ? `${b.title}: ` : ""}${b.text}`);
        break;
    }
  }
  return out.join("\n").trim();
}

/** Extract every mention from a block list (mentions → notifications). */
export function collectMentions(input: MessageBlock[]): BlockMention[] {
  const found: BlockMention[] = [];
  const push = (m: BlockMention) => {
    if (!found.some((x) => x.id === m.id && x.kind === m.kind)) found.push(m);
  };
  for (const b of input) {
    if (b.type === "context") {
      for (const e of b.elements) if (e.mention) push(e.mention);
    }
  }
  return found;
}

/** All attachment assetIds referenced by blocks (for validation on write). */
export function collectAssetIds(input: MessageBlock[]): string[] {
  return input.flatMap((b) => (b.type === "attachment" ? [b.assetId] : []));
}

// Zod v4: discriminatedUnion needs its options' literals statically — re-export
// a parser for API input validation.
export const parseMessageBlocks = (value: unknown): MessageBlock[] => messageBlocks.parse(value);
