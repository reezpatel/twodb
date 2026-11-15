import { blocksToText, type MessageBlock } from "../blocks.js";
import type { MessagePayload } from "../db/repository.js";

/** The agent-readable form of a message. Artisan never parses TwoChat blocks — this is the contract. */
export interface RenderedMessage {
  id: string;
  author: { id: string; type: "user" | "bot"; name: string };
  at: string;
  text: string;
  attachments?: Array<{ kind: string; url?: string; assetId?: string; name?: string; alt?: string }>;
  interactive?: Array<{ kind: string; labels: string[]; state?: string }>;
  actions?: Array<{ by: string; actionId: string; label?: string; value?: string | null; at: string }>;
}

export interface ActionClick {
  messageId: string;
  actionId: string;
  value: string | null;
  userName: string;
  createdAt: string;
}

/**
 * Per-component policy lives here, in one place:
 *   markdown/field/code/…  → the text projection
 *   buttons                → "offered [A] [B]" + who clicked what
 *   images/attachments     → name + alt + url, never bytes
 *   anything unknown       → its text projection, or a placeholder naming the type and size (custom HTML never goes through)
 */
export function renderMessage(m: MessagePayload, clicks: ActionClick[]): RenderedMessage {
  const blocks: MessageBlock[] = m.blocks ?? [];
  const attachments: NonNullable<RenderedMessage["attachments"]> = [];
  const interactive: NonNullable<RenderedMessage["interactive"]> = [];
  const buttonLabels = new Map<string, string>();

  for (const b of blocks) {
    if (b.type === "image") attachments.push({ kind: "image", url: b.url, alt: b.alt ?? b.title });
    else if (b.type === "attachment") attachments.push({ kind: "file", assetId: (b as { assetId?: string }).assetId, name: b.filename });
    else if (b.type === "actions") {
      const mine = clicks.filter((c) => c.messageId === m.id);
      interactive.push({
        kind: "buttons",
        labels: b.elements.map((e) => e.text),
        state: mine.length ? `answered (${mine.length})` : "waiting for an answer",
      });
      for (const e of b.elements) buttonLabels.set(e.actionId, e.text);
    }
  }

  const mine = clicks.filter((c) => c.messageId === m.id);
  return {
    id: m.id,
    author: { id: (m.authorType === "bot" ? m.botId : m.userId) ?? "", type: m.authorType, name: m.authorName },
    at: m.createdAt,
    text: (m.text || blocksToText(blocks)).slice(0, 4000),
    ...(attachments.length ? { attachments } : {}),
    ...(interactive.length ? { interactive } : {}),
    ...(mine.length ? { actions: mine.map((c) => ({ by: c.userName, actionId: c.actionId, label: buttonLabels.get(c.actionId), value: c.value, at: c.createdAt })) } : {}),
  };
}
