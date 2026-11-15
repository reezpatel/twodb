// Wire contract with Artisan (the other half lives in apps/artisan/src/collab/types.ts).

export const RUNTIME_APP = "artisan";

/** Jobs TwoChat sends to Artisan. */
export const RUN_JOB = "artisan.collab.run";
export const CANCEL_JOB = "artisan.collab.cancel";
export const ROLLBACK_JOB = "artisan.collab.rollback";

/** Messages TwoChat receives from Artisan. */
export const REPLY_MSG = "twochat.collab.reply";
export const EDIT_MSG = "twochat.collab.edit";
export const STATUS_MSG = "twochat.collab.status";
export const BOT_MSG = "twochat.collab.bot";

export interface ReplyPayload {
  workspaceId: string;
  runId: string;
  taskId: string;
  epoch: number;
  channelId: string;
  agentId: string;
  botId: string;
  messageId: string;
  message: { text: string; blocks?: unknown[] };
  isCompleted: boolean;
  workNote: string | null;
  sessionId: string | null;
  answeredTriggers: string[];
  outcome: "ok" | "failed" | "stopped";
}

export interface EditPayload {
  workspaceId: string;
  runId: string;
  taskId: string;
  epoch: number;
  channelId: string;
  botId: string;
  messageId: string;
  message: { text: string; blocks?: unknown[] };
}

export interface StatusPayload {
  workspaceId: string;
  runId: string;
  taskId: string;
  epoch: number;
  channelId: string;
  botId: string;
  state: "started" | "stopped" | "failed" | "idle";
  text?: string;
}

export interface BotPayloadIn {
  workspaceId: string;
  agentId: string;
  name: string;
  description: string;
  enabled: boolean;
  deleted: boolean;
}

/** How long a run may take end to end before TwoChat gives up and tells the user. */
export const RUN_DEADLINE_MS = 60 * 60_000;
/** A task nobody touches for this long is closed. */
export const TASK_IDLE_MS = 24 * 60 * 60_000;
export const WINDOW_SIZE = 50;
/** Messages to the same collaborator within this window become ONE run (and so one reply). */
export const DEBOUNCE_MS = 2_000;
