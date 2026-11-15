import { z } from "zod";
import { defineAppMessages, defineJob } from "@twodb/core-async/registry";

// Jobs and outbound messages for chat collaborators (TwoChat ⇄ Artisan). Delivery is the core-async relay:
// the sender enqueues locally, a relay worker POSTs to the other app's /_svc/inbox with a control-plane-signed
// service token, the receiver dedupes and enqueues into its own queue. Run `pnpm gen:docs` after changes.

const snapshotMessage = z.object({
  id: z.string(),
  author: z.object({ id: z.string(), type: z.enum(["user", "bot"]), name: z.string() }),
  at: z.string(),
  text: z.string(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
  interactive: z.array(z.record(z.string(), z.unknown())).optional(),
  actions: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const collabRunJob = defineJob({
  type: "artisan.collab.run",
  description:
    "From TwoChat: start (or resume) a collaborator's work on one task. Carries the trigger and a snapshot of the last ~50 rendered messages. " +
    "Artisan runs a non-interactive session that must end with send_reply, which is relayed back as twochat.collab.reply.",
  direction: "consumes",
  payload: z.object({
    runId: z.string(), taskId: z.string(), epoch: z.number(), channelId: z.string(), agentId: z.string(), botId: z.string(),
    mode: z.enum(["direct", "group"]),
    trigger: z.object({ type: z.enum(["message", "action"]), messageId: z.string(), actionId: z.string().optional(), value: z.string().nullable().optional() }),
    sinceMessageId: z.string().nullable(),
    snapshot: z.array(snapshotMessage),
    participants: z.array(z.object({ id: z.string(), type: z.enum(["user", "bot"]), name: z.string() })),
    priorWorkNote: z.string().nullable(),
    deadlineAt: z.string(),
    schemaVersion: z.string().optional(),
  }),
  retryNotes: "maxAttempts 1 — a blind retry would repeat side effects. A dead worker is turned into a failure reply by the lease reaper.",
});

export const collabCancelJob = defineJob({
  type: "artisan.collab.cancel",
  description: "From TwoChat: stop a run (queued runs never start; a running session is aborted; files already changed stay changed).",
  direction: "consumes",
  payload: z.object({ runId: z.string(), epoch: z.number() }),
  retryNotes: "Idempotent.",
});

export const collabRollbackJob = defineJob({
  type: "artisan.collab.rollback",
  description:
    "From TwoChat: roll a task back. Bumps the task epoch, cancels in-flight runs, rewinds the session to just before `fromRunId`, " +
    "and (only when asked and the directory is a git repo) restores files from the checkpoint taken before that run.",
  direction: "consumes",
  payload: z.object({ taskId: z.string(), newEpoch: z.number(), fromRunId: z.string().nullable(), restoreFiles: z.boolean() }),
  retryNotes: "Idempotent.",
});

export const collabReplyMessage = defineJob({
  type: "twochat.collab.reply",
  description: "To TwoChat (via relay): the collaborator's reply for a run. `isCompleted` is authoritative for whether the task is finished.",
  direction: "produces",
  payload: z.object({ runId: z.string(), taskId: z.string(), epoch: z.number(), messageId: z.string(), isCompleted: z.boolean(), outcome: z.enum(["ok", "failed", "stopped"]) }).passthrough(),
});

export const collabEditMessage = defineJob({
  type: "twochat.collab.edit",
  description: "To TwoChat (via relay): the collaborator edited one of its own earlier replies.",
  direction: "produces",
  payload: z.object({ runId: z.string(), taskId: z.string(), epoch: z.number(), messageId: z.string() }).passthrough(),
});

export const collabStatusMessage = defineJob({
  type: "twochat.collab.status",
  description: "To TwoChat (via relay): run state for the typing indicator (started | stopped | failed).",
  direction: "produces",
  payload: z.object({ runId: z.string(), taskId: z.string(), epoch: z.number(), state: z.string() }).passthrough(),
});

export const collabBotMessage = defineJob({
  type: "twochat.collab.bot",
  description: "To TwoChat (via relay): a collaborator agent was created, changed (enabled = has a runner and directory) or deleted — TwoChat mirrors it as a bot.",
  direction: "produces",
  payload: z.object({ agentId: z.string(), name: z.string(), description: z.string(), enabled: z.boolean(), deleted: z.boolean() }),
});

export const messages = defineAppMessages({
  name: "Artisan",
  slug: "artisan",
  jobs: [collabRunJob, collabCancelJob, collabRollbackJob, collabReplyMessage, collabEditMessage, collabStatusMessage, collabBotMessage],
  events: [],
});

export default messages;
