import type { RenderedMessage, RunPayload } from "./types.js";

/** One line (plus indented extras) per message, in a form a model reads as a transcript, not as chat turns. */
export function renderMessage(m: RenderedMessage, botId: string): string {
  const who = m.author.type === "bot" && m.author.id === botId ? "You" : m.author.name || m.author.id;
  const when = m.at ? m.at.replace("T", " ").slice(0, 16) : "";
  const lines = [`[${when}] ${who}: ${m.text?.trim() || "(no text)"}`];
  for (const a of m.attachments ?? []) {
    lines.push(`    (attachment: ${[a.kind, a.name, a.alt, a.url ?? a.assetId].filter(Boolean).join(" · ")})`);
  }
  for (const i of m.interactive ?? []) {
    lines.push(`    (offered ${i.kind}: ${i.labels.map((l) => `[${l}]`).join(" ")}${i.state ? ` — ${i.state}` : ""})`);
  }
  for (const a of m.actions ?? []) {
    lines.push(`    (${a.by} chose ${a.label ? `"${a.label}"` : a.actionId}${a.value ? ` = ${a.value}` : ""})`);
  }
  return lines.join("\n");
}

function triggerLine(p: RunPayload): string {
  const t = p.trigger;
  if (t.type !== "action") return "";
  const target = p.snapshot.find((m) => m.id === t.messageId);
  const click = target?.actions?.find((a) => a.actionId === t.actionId) ?? target?.actions?.[target.actions.length - 1];
  const who = click?.by ?? "The user";
  return `\nThis run was started by an interaction: ${who} chose ${click?.label ? `"${click.label}"` : (t.actionId ?? "an option")}${t.value ? ` (value: ${t.value})` : ""} on one of your messages.`;
}

/**
 * The user message that opens a run.
 *  - New task/session: the whole snapshot, plus the work note of the previous task.
 *  - Resumed session: only what happened since the previous run saw the conversation.
 */
export function buildFrame(p: RunPayload, opts: { resumed: boolean; supersededTriggers: string[] }): string {
  const others = p.participants.filter((x) => !(x.type === "bot" && x.id === p.botId)).map((x) => x.name).join(", ") || "the user";
  let messages = p.snapshot;
  if (opts.resumed && p.sinceMessageId) {
    const at = p.snapshot.findIndex((m) => m.id === p.sinceMessageId);
    if (at >= 0) messages = p.snapshot.slice(at + 1);
  }
  const transcript = messages.map((m) => renderMessage(m, p.botId)).join("\n");
  const parts: string[] = [];
  if (opts.resumed) {
    parts.push(`New messages in the chat with ${others} since your last reply:`, "", transcript || "(nothing new — they may have interacted with one of your messages)");
  } else {
    parts.push(`You are chatting with ${others} in TwoChat. Conversation so far (oldest first):`, "", transcript);
    if (p.priorWorkNote) parts.push("", `Notes you left after your previous task with them:\n${p.priorWorkNote}`);
  }
  const t = triggerLine(p);
  if (t) parts.push(t);
  if (opts.supersededTriggers.length > 1) {
    parts.push(`\nThey sent ${opts.supersededTriggers.length} messages while you were busy — answer all of them in one reply.`);
  }
  parts.push("", "Do what the latest message(s) ask, then finish by calling send_reply.");
  return parts.join("\n");
}

export function collabSystemPrompt(p: RunPayload): string {
  return [
    "## Chat collaborator mode",
    `You are a collaborator in a chat app (channel ${p.channelId}). A person talks to you there; you work on your own machine and reply in the chat.`,
    "- This run is NON-INTERACTIVE. You cannot ask a question and wait. If you need a decision or missing information, call send_reply with your question —",
    "  ideally as buttons or inputs (describe_message_format shows how) — and is_completed=false. Their answer starts your next run with this same session.",
    "- You MUST end the run by calling send_reply. Text you write without it is never shown to the user.",
    "- is_completed=true means: the request is finished and nothing is pending. Use false whenever you are waiting for the user or only finished a step.",
    "- Keep replies short and concrete: say what you did, what changed, and what (if anything) you need next. Don't paste long files or logs.",
    "- Use work_note in send_reply to leave yourself notes (what you did, files touched, what remains) — the user doesn't see it.",
  ].join("\n");
}
