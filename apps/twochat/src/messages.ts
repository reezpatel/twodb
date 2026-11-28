import { z } from "zod";
import { defineAppMessages, defineBroadcastEvent, defineJob } from "@twodb/core-async/registry";

export const messagePostedEvent = defineBroadcastEvent({
  event: "twochat.message.posted",
  description:
    "Published on every new message (human or bot) — envelope only (ids + channel), not the full payload. " +
    "Future consumers: push delivery, agent listeners that react to channels they're in.",
  direction: "produces",
  relatedApps: [],
  payload: z.object({
    messageId: z.string(),
    channelId: z.string(),
    authorType: z.enum(["user", "bot"]),
    authorId: z.string().nullable(),
    createdAt: z.string(),
  }),
});

export const messageActionEvent = defineBroadcastEvent({
  event: "twochat.message.action",
  description:
    "Published when a user clicks a button in a bot-authored composed message. The click is also durable in the bot's GET /bots/actions inbox.",
  direction: "produces",
  relatedApps: [],
  payload: z.object({
    id: z.string(),
    messageId: z.string(),
    channelId: z.string(),
    botId: z.string(),
    actionId: z.string(),
    value: z.string().nullable(),
    userId: z.string(),
    acknowledgedAt: z.string().nullable(),
    createdAt: z.string(),
  }),
});

export const conversationImportedEvent = defineBroadcastEvent({
  event: "twochat.conversation.imported",
  description: "Published after external messages are idempotently copied into a read-only conversation in any list group.",
  direction: "produces",
  relatedApps: [],
  payload: z.object({
    conversationId: z.string(),
    inserted: z.number(),
    duplicate: z.number(),
    importedAt: z.string(),
  }),
});

// twochat.notification.created is gone: notifications are now created + pushed
// by the control plane (TwoDB), which owns the cross-app inbox and Web Push.

export const sweepReadStateJob = defineJob({
  type: "twochat.read_state.sweep",
  description:
    "Maintenance sweep (hourly): recomputes unread counts from read cursors. Unread counts are computed lazily per request today; " +
    "this job exists as the future fan-out point for badge counts to offline clients.",
  direction: "produces+consumes",
  payload: z.object({ workspaceId: z.string().optional() }),
  retryNotes: "Idempotent; safe to retry.",
});

const collabIn = (type: string, description: string, payload: z.ZodType) =>
  defineJob({ type, description, direction: "consumes", payload, retryNotes: "Delivered by the core-async relay (at-least-once); every handler is idempotent on its dedupe key." });

export const collabReplyJob = collabIn(
  "twochat.collab.reply",
  "From Artisan: a collaborator's reply for a run. Posted as the bot; `isCompleted` is authoritative for closing the task. Dropped when its epoch is older than the task's (rolled back).",
  z.object({ runId: z.string(), taskId: z.string(), epoch: z.number(), messageId: z.string(), isCompleted: z.boolean(), outcome: z.enum(["ok", "failed", "stopped"]) }).passthrough(),
);
export const collabEditJob = collabIn(
  "twochat.collab.edit",
  "From Artisan: the collaborator edited one of its own earlier replies in the same task.",
  z.object({ runId: z.string(), taskId: z.string(), epoch: z.number(), messageId: z.string() }).passthrough(),
);
export const collabStatusJob = collabIn(
  "twochat.collab.status",
  "From Artisan: run state (started | stopped | failed) driving the 'is working' indicator.",
  z.object({ runId: z.string(), taskId: z.string(), epoch: z.number(), state: z.string() }).passthrough(),
);
export const collabBotJob = collabIn(
  "twochat.collab.bot",
  "From Artisan: a collaborator agent was created, changed or deleted — mirrored here as a bot (enabled only while it has a runner and directory).",
  z.object({ agentId: z.string(), name: z.string(), description: z.string(), enabled: z.boolean(), deleted: z.boolean() }),
);

export const messages = defineAppMessages({
  name: "TwoChat",
  slug: "twochat",
  jobs: [sweepReadStateJob, collabReplyJob, collabEditJob, collabStatusJob, collabBotJob],
  events: [messagePostedEvent, messageActionEvent, conversationImportedEvent],
});

export default messages;
