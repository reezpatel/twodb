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

export const notificationCreatedEvent = defineBroadcastEvent({
  event: "twochat.notification.created",
  description: "Published when a user notification is created (mention, DM, bot post) — the hook for future push/email delivery.",
  direction: "produces",
  relatedApps: [],
  payload: z.object({
    notificationId: z.string(),
    userId: z.string(),
    kind: z.enum(["mention", "dm", "channel", "bot-post", "system"]),
    channelId: z.string().nullable(),
    createdAt: z.string(),
  }),
});

export const sweepReadStateJob = defineJob({
  type: "twochat.read_state.sweep",
  description:
    "Maintenance sweep (hourly): recomputes unread counts from read cursors. Unread counts are computed lazily per request today; " +
    "this job exists as the future fan-out point for badge counts to offline clients.",
  direction: "produces+consumes",
  payload: z.object({ workspaceId: z.string().optional() }),
  retryNotes: "Idempotent; safe to retry.",
});

export const messages = defineAppMessages({
  name: "TwoChat",
  slug: "twochat",
  jobs: [sweepReadStateJob],
  events: [messagePostedEvent, messageActionEvent, notificationCreatedEvent],
});

export default messages;
