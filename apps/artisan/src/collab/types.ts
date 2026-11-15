// Wire types shared with TwoChat. Messages are ids + small envelopes, except `snapshot`, which is the
// conversation as TwoChat rendered it for an agent (TwoChat owns that shape; Artisan only reads it).

export const COLLAB_APP = "twochat";

/** Jobs Artisan consumes (declared in messages.ts). */
export const RUN_JOB = "artisan.collab.run";
export const CANCEL_JOB = "artisan.collab.cancel";
export const ROLLBACK_JOB = "artisan.collab.rollback";

/** Messages Artisan sends to TwoChat. */
export const REPLY_MSG = "twochat.collab.reply";
export const EDIT_MSG = "twochat.collab.edit";
export const STATUS_MSG = "twochat.collab.status";
export const BOT_MSG = "twochat.collab.bot";

export interface RenderedMessage {
  id: string;
  author: { id: string; type: "user" | "bot"; name: string };
  at: string;
  /** Flattened, markdown-ish text projection of the message. */
  text: string;
  attachments?: Array<{ kind: string; url?: string; assetId?: string; name?: string; alt?: string }>;
  /** What the message offered (buttons, forms…) and its current state. */
  interactive?: Array<{ kind: string; labels: string[]; state?: string }>;
  /** Clicks / submissions on it. */
  actions?: Array<{ by: string; actionId: string; label?: string; value?: string | null; at: string }>;
}

export interface RunPayload {
  workspaceId: string;
  runId: string;
  taskId: string;
  epoch: number;
  channelId: string;
  /** The Artisan collaborator agent. */
  agentId: string;
  /** The TwoChat bot that represents it (the author of replies). */
  botId: string;
  mode: "direct" | "group";
  trigger: { type: "message" | "action"; messageId: string; actionId?: string; value?: string | null };
  /** Id of the last message the previous run on this task already saw; resumed sessions only get what came after it. */
  sinceMessageId: string | null;
  /** Last ~50 messages as of the trigger, oldest first. */
  snapshot: RenderedMessage[];
  participants: Array<{ id: string; type: "user" | "bot"; name: string }>;
  /** Work note of the previous task with this user (after a completed task, a new session starts from it). */
  priorWorkNote: string | null;
  deadlineAt: string;
  schemaVersion?: string;
}

export interface CancelPayload { workspaceId: string; runId: string; epoch: number }

export interface RollbackPayload {
  workspaceId: string;
  taskId: string;
  newEpoch: number;
  /** The earliest run being undone: the session is rewound to just before it. */
  fromRunId: string | null;
  /** Restore the directory from the checkpoint taken before `fromRunId` (git directories only). */
  restoreFiles: boolean;
}

export interface ReplyPayload {
  runId: string;
  taskId: string;
  epoch: number;
  channelId: string;
  agentId: string;
  botId: string;
  /** Chosen by Artisan so edit_reply can refer to it later. */
  messageId: string;
  message: { text: string; blocks?: unknown[] };
  isCompleted: boolean;
  workNote: string | null;
  sessionId: string | null;
  /** Triggers that were folded into this run (several quick messages → one reply). */
  answeredTriggers: string[];
  /** "ok" for normal replies; "failed"/"stopped" for harness-generated ones. */
  outcome: "ok" | "failed" | "stopped";
}
