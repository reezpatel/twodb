import { ulid } from "ulid";
import type { ToolSpec } from "../ws/agent-loop.js";
import type { CollabRepo } from "./repo.js";
import { COLLAB_APP, EDIT_MSG, REPLY_MSG, type ReplyPayload, type RunPayload } from "./types.js";

/** Mutable state of one collaborator run, shared between the tools and the runner. */
export interface RunState {
  payload: RunPayload;
  sessionId: string;
  replied: boolean;
  replyMessageId: string | null;
  isCompleted: boolean;
  workNote: string | null;
  answeredTriggers: string[];
  edits: number;
}

export interface ServiceFetch {
  (audience: string, workspaceId: string, path: string, init?: RequestInit & { scopes?: string[]; act?: { type: string; id: string } }): Promise<Response>;
}

export interface CollabToolDeps {
  repo: CollabRepo;
  serviceFetch: ServiceFetch;
  relay: { send(msg: { app: string; type: string; workspaceId: string; payload: unknown; dedupeKey: string; act?: { type: string; id: string } }): Promise<unknown> };
}

/** A message that still waits for the user (buttons, inputs…): the task cannot be complete. */
const INTERACTIVE_BLOCK = /^(actions|input|form|select|button)/;

export function hasInteractive(components: unknown[] | undefined): boolean {
  return Boolean(components?.some((c) => c && typeof c === "object" && INTERACTIVE_BLOCK.test(String((c as { type?: unknown }).type ?? ""))));
}

/** Ask TwoChat (the owner of the message shape) whether this message is valid. Network trouble ≠ invalid. */
async function validateMessage(deps: CollabToolDeps, workspaceId: string, message: { text: string; blocks?: unknown[] }): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await deps.serviceFetch(COLLAB_APP, workspaceId, "/_svc/messages/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
      scopes: ["twochat.messages.validate"],
    });
    if (!res.ok) return { ok: true }; // TwoChat re-validates on arrival and falls back to plain text
    const body = (await res.json()) as { ok?: boolean; error?: string };
    return body.ok ? { ok: true } : { ok: false, error: body.error ?? "invalid message" };
  } catch {
    return { ok: true };
  }
}

const schemaCache: { at: number; body: { version: string; guide: string; schema: unknown } | null } = { at: 0, body: null };

async function fetchFormat(deps: CollabToolDeps, workspaceId: string) {
  if (schemaCache.body && Date.now() - schemaCache.at < 5 * 60_000) return schemaCache.body;
  const res = await deps.serviceFetch(COLLAB_APP, workspaceId, "/_svc/messages/schema", { scopes: ["twochat.messages.schema"] });
  if (!res.ok) throw new Error(`TwoChat answered ${res.status}`);
  schemaCache.body = (await res.json()) as { version: string; guide: string; schema: unknown };
  schemaCache.at = Date.now();
  return schemaCache.body;
}

/** Pick one component's schema out of a oneOf/anyOf union by its `type` literal. */
function pickComponent(schema: unknown, component: string): unknown {
  const s = schema as { oneOf?: unknown[]; anyOf?: unknown[]; items?: unknown };
  const variants = (s.oneOf ?? s.anyOf ?? (s.items as { oneOf?: unknown[]; anyOf?: unknown[] } | undefined)?.oneOf ?? (s.items as { anyOf?: unknown[] } | undefined)?.anyOf) as Array<{ properties?: { type?: { const?: string; enum?: string[] } } }> | undefined;
  if (!variants) return null;
  return variants.find((v) => v.properties?.type?.const === component || v.properties?.type?.enum?.includes(component)) ?? null;
}

function componentNames(schema: unknown): string[] {
  const s = schema as { oneOf?: unknown[]; anyOf?: unknown[]; items?: { oneOf?: unknown[]; anyOf?: unknown[] } };
  const variants = (s.oneOf ?? s.anyOf ?? s.items?.oneOf ?? s.items?.anyOf ?? []) as Array<{ properties?: { type?: { const?: string } } }>;
  return variants.map((v) => v.properties?.type?.const ?? "").filter(Boolean);
}

export function collabTools(state: RunState, deps: CollabToolDeps): ToolSpec[] {
  const p = state.payload;

  const componentsParam = {
    type: "array",
    description: "Optional rich components (buttons, images, fields…) shown after the markdown. Call describe_message_format for what is available.",
    items: { type: "object" },
  };

  return [
    {
      name: "send_reply",
      description:
        "Send your reply to the chat and end this run. You MUST finish every run with this tool — nothing you write otherwise reaches the user. " +
        "Set is_completed=true only when the request is fully done and you are not waiting for anything; set it false when you asked the user something " +
        "(post buttons/inputs as components — you cannot wait for an answer, their answer starts your next run), or finished one step of a larger job.",
      parameters: {
        type: "object",
        properties: {
          markdown: { type: "string", description: "The message text (markdown). Be concise." },
          components: componentsParam,
          is_completed: { type: "boolean", description: "true = the task is finished; false = it stays open for the user's next message." },
          work_note: { type: "string", description: "Private note to your future self: what you did, files touched, what is left. Not shown to the user." },
        },
        required: ["markdown", "is_completed"],
      },
      async execute(args) {
        if (state.replied) return "error: you already replied in this run. Use edit_reply to change that message; the run ends now.";
        const markdown = String(args.markdown ?? "").trim();
        const components = Array.isArray(args.components) ? (args.components as unknown[]) : undefined;
        if (!markdown && !components?.length) return "error: the reply is empty — write a message.";
        const isCompleted = args.is_completed === true;
        if (isCompleted && hasInteractive(components)) {
          return "error: you set is_completed=true but the message contains buttons/inputs the user still has to answer. Choose: is_completed=false (you are waiting for them), or remove the interactive components.";
        }
        const message = { text: markdown, ...(components?.length ? { blocks: components } : {}) };
        const verdict = await validateMessage(deps, p.workspaceId, message);
        if (!verdict.ok) return `error: TwoChat rejected the message: ${verdict.error}. Fix it (describe_message_format shows the shape) and call send_reply again.`;

        const messageId = ulid();
        const workNote = typeof args.work_note === "string" && args.work_note.trim() ? args.work_note.trim().slice(0, 4000) : markdown.slice(0, 800);
        const reply: ReplyPayload = {
          runId: p.runId, taskId: p.taskId, epoch: p.epoch, channelId: p.channelId, agentId: p.agentId, botId: p.botId,
          messageId, message, isCompleted, workNote, sessionId: state.sessionId, answeredTriggers: state.answeredTriggers, outcome: "ok",
        };
        await deps.relay.send({ app: COLLAB_APP, type: REPLY_MSG, workspaceId: p.workspaceId, payload: reply, dedupeKey: `${p.runId}:reply`, act: { type: "bot", id: p.botId } });
        state.replied = true;
        state.replyMessageId = messageId;
        state.isCompleted = isCompleted;
        state.workNote = workNote;
        await deps.repo.patchRun(p.runId, { replied: 1, reply_message_id: messageId });
        return `Reply queued for delivery (ref ${messageId}). The run is finished${isCompleted ? " and the task is complete" : "; the task stays open"}.`;
      },
    },
    {
      name: "edit_reply",
      description:
        "Edit a message you sent earlier in this conversation (by the ref send_reply returned): update a progress note, or remove buttons that were already answered. " +
        "Only your own replies from this task can be edited.",
      parameters: {
        type: "object",
        properties: {
          ref: { type: "string", description: "The ref of the message to edit." },
          markdown: { type: "string" },
          components: componentsParam,
        },
        required: ["ref", "markdown"],
      },
      async execute(args) {
        const ref = String(args.ref ?? "");
        const own = await deps.repo.replyIdsForTask(p.taskId);
        if (!own.includes(ref)) return "error: unknown ref — you can only edit replies you sent in this task.";
        const components = Array.isArray(args.components) ? (args.components as unknown[]) : undefined;
        const message = { text: String(args.markdown ?? "").trim(), ...(components?.length ? { blocks: components } : {}) };
        if (!message.text && !components?.length) return "error: the edited message would be empty.";
        const verdict = await validateMessage(deps, p.workspaceId, message);
        if (!verdict.ok) return `error: TwoChat rejected the message: ${verdict.error}.`;
        state.edits += 1;
        await deps.relay.send({
          app: COLLAB_APP, type: EDIT_MSG, workspaceId: p.workspaceId,
          payload: { runId: p.runId, taskId: p.taskId, epoch: p.epoch, channelId: p.channelId, botId: p.botId, messageId: ref, message },
          dedupeKey: `${p.runId}:edit:${state.edits}`, act: { type: "bot", id: p.botId },
        });
        return "Edit queued.";
      },
    },
    {
      name: "describe_message_format",
      description:
        "How to compose chat messages: the guide and exact schema of the rich components available (buttons, images, fields…). " +
        "Without `component` you get the guide and the list of component names; with one you get that component's exact schema.",
      parameters: { type: "object", properties: { component: { type: "string", description: "e.g. \"actions\" or \"image\"" } } },
      async execute(args) {
        let fmt;
        try {
          fmt = await fetchFormat(deps, p.workspaceId);
        } catch (err) {
          return `could not load the message format (${(err as Error).message}); send plain markdown.`;
        }
        const component = typeof args.component === "string" ? args.component.trim() : "";
        if (component) {
          const one = pickComponent(fmt.schema, component);
          if (!one) return `unknown component "${component}". Available: ${componentNames(fmt.schema).join(", ") || "(see the full schema)"}`;
          return JSON.stringify(one);
        }
        const names = componentNames(fmt.schema);
        return `${fmt.guide}\n\nComponents: ${names.join(", ") || "(see schema)"}\nCall describe_message_format with a component name for its exact schema.`;
      },
    },
  ];
}
