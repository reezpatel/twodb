import { createHash } from "node:crypto";
import { z } from "zod";
import { messageBlocks } from "../blocks.js";

/**
 * What collaborators (agents) are told about composing messages. TwoChat owns this next to the block schema:
 * change a component → update its line here in the same commit. Artisan fetches it on demand
 * (describe_message_format) and never hard-codes the shape.
 */
export const COMPOSE_GUIDE = [
  "A reply is markdown text plus optional rich components.",
  "- Prefer plain markdown. Use components only when they make the reply easier to act on.",
  "- Need a decision from the person? Post an `actions` component (up to 5 `button`s, each with a unique actionId and a short text). Their click starts your next run — you cannot wait for it. Set is_completed=false.",
  "- `image`/`attachment` show files (upload with the app's attach flow; never inline data). `field` shows label/value rows, `code` a snippet, `status` a one-line state, `task-list` a checklist, `callout` a highlighted note.",
  "- Keep it short: a few lines of text, at most a handful of components. Link or attach long output instead of pasting it.",
  "- Interactive components (buttons) mean the task is not finished: do not mark it completed while you are waiting on them.",
  "- Custom HTML, sliders, video and form inputs are not part of the shape yet — if they appear in the schema below, you may use them; otherwise do not invent types.",
].join("\n");

export function messageFormat() {
  const schema = z.toJSONSchema(messageBlocks, { unrepresentable: "any" });
  const version = createHash("sha1").update(JSON.stringify(schema)).update(COMPOSE_GUIDE).digest("hex").slice(0, 12);
  return { version, guide: COMPOSE_GUIDE, schema };
}

/** The agent's message ({text, components}) as stored blocks, validated against the live schema. */
export function composeAgentMessage(input: { text?: unknown; blocks?: unknown }): { text: string; blocks: z.infer<typeof messageBlocks> | null } | { error: string } {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const extra = Array.isArray(input.blocks) ? input.blocks : [];
  if (!text && !extra.length) return { error: "empty message" };
  const blocks = [...(text ? [{ type: "markdown", text }] : []), ...extra];
  const parsed = messageBlocks.safeParse(blocks);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue?.path.join(".") || "message"}: ${issue?.message ?? "invalid"}` };
  }
  return { text: text || "", blocks: parsed.data.length === 1 && parsed.data[0].type === "markdown" ? null : parsed.data };
}
