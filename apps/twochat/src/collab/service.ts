import { ulid } from "ulid";
import type { Kysely } from "kysely";
import type { Relay } from "@twodb/core-async/relay";
import type { TwoChatDb } from "../db/schema.js";
import { botActor, userActor, type ChatRepo, type MessagePayload } from "../db/repository.js";
import type { MessageBlock } from "../blocks.js";
import type { ChatHub, ServerFrame } from "../ws/hub.js";
import { composeAgentMessage } from "./guide.js";
import { renderMessage, type ActionClick, type RenderedMessage } from "./render.js";
import { createCollabStore } from "./service-state.js";
import {
  CANCEL_JOB, DEBOUNCE_MS, ROLLBACK_JOB, RUN_JOB, RUN_DEADLINE_MS, TASK_IDLE_MS, WINDOW_SIZE,
  type BotPayloadIn, type EditPayload, type ReplyPayload, type StatusPayload,
} from "./types.js";

interface Log {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
}

export interface CollabDeps {
  db: Kysely<TwoChatDb>;
  repo: ChatRepo;
  relay: Relay;
  hub: ChatHub;
  log: Log;
  /** Fan a posted message out (websocket frame, broadcast event, notifications). */
  publishPosted(workspaceId: string, message: MessagePayload, notifyUserIds: string[], notification: { kind: "mention" | "dm" | "channel"; title: string; body: string }): void;
  publishToChannel(workspaceId: string, channelId: string, frame: ServerFrame): Promise<void>;
}

const ROLLBACK_PREFIX = "collab:rollback:";
const asIso = (v: unknown) => new Date(v as string).toISOString();

export function createCollabService(d: CollabDeps) {
  const store = createCollabStore(d.db);
  /** Pending message triggers, keyed channel:bot (in memory — the window is two seconds). */
  const debounce = new Map<string, NodeJS.Timeout>();

  const sendToArtisan = (type: string, workspaceId: string, payload: unknown, dedupeKey: string) =>
    d.relay.send({ app: "artisan", type, workspaceId, payload, dedupeKey });

  const frame = (workspaceId: string, channelId: string, botId: string, taskId: string | null, runId: string | null, state: Extract<ServerFrame, { type: "collab_status" }>["state"]) =>
    d.publishToChannel(workspaceId, channelId, { type: "collab_status", channelId, botId, taskId, runId, state }).catch(() => undefined);

  /** The last WINDOW_SIZE live messages up to and including `upToCreatedAt`, rendered for an agent. */
  async function snapshot(workspaceId: string, channelId: string, upToCreatedAt: string): Promise<{ messages: RenderedMessage[]; participants: Array<{ id: string; type: "user" | "bot"; name: string }> }> {
    const rows = await d.db.selectFrom("message").selectAll().where("channel_id", "=", channelId).where("rolled_back_at", "is", null).where("deleted_at", "is", null)
      .where("created_at", "<=", upToCreatedAt).orderBy("created_at", "desc").limit(WINDOW_SIZE).execute();
    rows.reverse();
    const hydrated = await d.repo.hydrateMessages(workspaceId, userActor("collab-snapshot"), rows);
    const members = await d.repo.memberPayloads(workspaceId, channelId);
    const names = new Map(members.flatMap((m) => (m.userId ? [[m.userId, m.name] as const] : [])));
    const ids = rows.map((r) => r.id);
    const actionRows = ids.length ? await d.db.selectFrom("message_action").selectAll().where("message_id", "in", ids).orderBy("created_at", "asc").execute() : [];
    const clicks: ActionClick[] = actionRows.map((a) => ({
      messageId: a.message_id, actionId: a.action_id, value: a.value,
      userName: names.get(a.user_id.replace(/^user:/, "")) ?? a.user_id, createdAt: asIso(a.created_at),
    }));
    return {
      messages: hydrated.map((m) => renderMessage(m, clicks)),
      participants: members.map((m) => ({ id: (m.type === "bot" ? m.botId : m.userId) ?? m.id, type: m.type, name: m.name })),
    };
  }

  /** Start (or continue) the collaborator's work on this conversation. */
  async function startRun(input: { workspaceId: string; channelId: string; bot: { id: string; runtime_ref: string | null }; trigger: { type: "message" | "action"; messageId: string; actionId?: string; value?: string | null } }): Promise<void> {
    const { workspaceId, channelId, bot, trigger } = input;
    if (!bot.runtime_ref) return;
    const triggerRow = await d.repo.getMessage(workspaceId, trigger.messageId);
    if (!triggerRow) return;

    let task = await store.openTask(channelId, bot.id);
    const priorWorkNote = task ? null : await store.lastWorkNote(channelId, bot.id);
    task ??= await store.createTask({ workspaceId, channelId, botId: bot.id });

    // What the collaborator already saw: everything up to the previous run's trigger.
    const previous = (await store.liveRuns(task.id)).find((r) => r.state === "done" || r.state === "stopped" || r.state === "failed");
    const sinceMessageId = previous?.trigger_message_id ?? null;

    const snap = await snapshot(workspaceId, channelId, asIso(triggerRow.created_at));
    const runId = ulid();
    const deadlineAt = new Date(Date.now() + RUN_DEADLINE_MS).toISOString();
    await store.insertRun({
      id: runId, task_id: task.id, workspace_id: workspaceId, channel_id: channelId, bot_id: bot.id, epoch: task.epoch,
      state: "queued", trigger_message_id: trigger.messageId, since_message_id: sinceMessageId, deadline_at: deadlineAt,
    });
    await store.patchTask(task.id, { touch: true });

    await sendToArtisan(RUN_JOB, workspaceId, {
      runId, taskId: task.id, epoch: task.epoch, channelId, agentId: bot.runtime_ref, botId: bot.id, mode: "direct",
      trigger, sinceMessageId, snapshot: snap.messages, participants: snap.participants, priorWorkNote, deadlineAt,
    }, runId);
    void frame(workspaceId, channelId, bot.id, task.id, runId, "queued");
  }

  /** Called for every posted message: a person writing to a collaborator (DM) or @-mentioning one (channel) starts a run. */
  async function onMessagePosted(workspaceId: string, message: MessagePayload): Promise<void> {
    if (message.authorType !== "user" || message.deletedAt) return;
    const channel = await d.repo.getChannel(workspaceId, message.channelId);
    if (!channel || channel.archived_at || channel.is_read_only) return;
    const members = await d.repo.memberPayloads(workspaceId, message.channelId);
    const botIds = members.filter((m) => m.type === "bot" && m.botId).map((m) => m.botId!);
    if (!botIds.length) return;
    const bots = (await store.runtimeBots(workspaceId, botIds)).filter((b) => b.enabled);
    if (!bots.length) return;

    const mentioned = (b: { id: string; name: string }) =>
      (message.blocks ?? []).some((blk) => blk.type === "rich-text" && blk.elements.some((e) => e.type === "mention" && e.id === b.id)) ||
      new RegExp(`(^|\\s)@${b.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\b|$)`, "i").test(message.text);
    const targets = channel.kind === "dm" ? bots : bots.filter(mentioned);
    for (const bot of targets) {
      // Debounce: a burst of messages becomes one run whose snapshot contains all of them, so the person gets one reply.
      const key = `${message.channelId}:${bot.id}`;
      const pending = debounce.get(key);
      if (pending) clearTimeout(pending);
      debounce.set(key, setTimeout(() => {
        debounce.delete(key);
        void startRun({ workspaceId, channelId: message.channelId, bot, trigger: { type: "message", messageId: message.id } })
          .catch((err) => d.log.warn({ err, botId: bot.id }, "collab: could not start run"));
      }, DEBOUNCE_MS));
    }
  }

  /** A button was clicked. Rollback buttons are ours; anything on a collaborator's message starts its next run. */
  async function onAction(workspaceId: string, message: { id: string; channel_id: string; bot_id: string | null }, actionId: string, value: string | null): Promise<void> {
    if (actionId.startsWith(ROLLBACK_PREFIX)) {
      const [runId, withFiles] = actionId.slice(ROLLBACK_PREFIX.length).split(":");
      const run = await store.getRun(runId);
      if (!run) return;
      const trigger = await d.repo.getMessage(workspaceId, run.trigger_message_id);
      if (trigger) await rollbackToBefore(workspaceId, trigger.channel_id, trigger.id, withFiles === "files");
      return;
    }
    if (!message.bot_id) return;
    const bot = (await store.runtimeBots(workspaceId, [message.bot_id])).find((b) => b.enabled);
    if (!bot) return;
    await startRun({ workspaceId, channelId: message.channel_id, bot, trigger: { type: "action", messageId: message.id, actionId, value } });
  }

  // -- inbound from Artisan ---------------------------------------------------------
  async function handleBot(p: BotPayloadIn): Promise<void> {
    const id = await store.upsertRuntimeBot(p.workspaceId, p.agentId, { name: p.name || "collaborator", description: p.description, enabled: p.enabled && !p.deleted });
    d.log.info({ botId: id, agentId: p.agentId, enabled: p.enabled && !p.deleted }, "collab: bot synced");
  }

  async function handleStatus(p: StatusPayload): Promise<void> {
    const task = await store.getTask(p.taskId);
    if (!task || p.epoch < task.epoch) return;
    if (p.state === "started") {
      const run = await store.getRun(p.runId);
      if (run?.state === "queued") await store.patchRun(p.runId, { state: "running" });
      void frame(p.workspaceId, p.channelId, p.botId, p.taskId, p.runId, "running");
    }
  }

  async function handleReply(p: ReplyPayload): Promise<void> {
    const [run, task] = await Promise.all([store.getRun(p.runId), store.getTask(p.taskId)]);
    if (!run || !task) return;
    if (p.epoch < task.epoch || run.state === "rolled_back") return; // a rolled-back conversation must not receive late replies
    if (run.reply_message_id) return; // already delivered

    // The agent's message goes through the live schema; if it no longer fits, degrade to its text instead of dropping it.
    const composed = composeAgentMessage({ text: p.message.text, blocks: p.message.blocks });
    let text: string;
    let blocks: MessageBlock[] | null;
    if ("error" in composed) {
      d.log.warn({ runId: p.runId, error: composed.error }, "collab: reply did not fit the message schema; sending text only");
      text = p.message.text?.trim() || "(the reply could not be displayed)";
      blocks = null;
    } else {
      text = composed.text;
      blocks = composed.blocks;
    }
    if (p.outcome === "stopped") {
      const undo: MessageBlock = {
        type: "actions",
        elements: [
          { type: "button", actionId: `${ROLLBACK_PREFIX}${p.runId}`, text: "Roll back messages", style: { variant: "outline" } as never },
          { type: "button", actionId: `${ROLLBACK_PREFIX}${p.runId}:files`, text: "Roll back messages + files", style: { variant: "outline" } as never },
        ],
      } as MessageBlock;
      blocks = [...(blocks ?? [{ type: "markdown", text }]), undo];
    }

    const result = await d.repo.postMessage({
      workspaceId: run.workspace_id, channelId: run.channel_id, author: botActor(run.bot_id), text, blocks, id: p.messageId,
      collab: { taskId: p.taskId, runId: p.runId, sessionId: p.sessionId, outcome: p.outcome },
    });
    if ("error" in result) {
      d.log.warn({ runId: p.runId, error: result.error }, "collab: could not post reply");
      return;
    }
    d.publishPosted(run.workspace_id, result.message, result.notifyUserIds, result.notification);

    await store.patchRun(p.runId, { state: p.outcome === "ok" ? "done" : p.outcome === "stopped" ? "stopped" : "failed", reply_message_id: p.messageId, finished_at: new Date().toISOString() });
    await store.patchTask(p.taskId, {
      status: p.outcome === "ok" && p.isCompleted ? "completed" : "open",
      session_id: p.sessionId ?? task.session_id,
      ...(p.outcome === "ok" ? { work_note: p.workNote } : {}),
      touch: true,
    });
    void frame(run.workspace_id, run.channel_id, run.bot_id, p.taskId, p.runId, p.outcome === "ok" ? "idle" : p.outcome);
  }

  async function handleEdit(p: EditPayload): Promise<void> {
    const task = await store.getTask(p.taskId);
    if (!task || p.epoch < task.epoch) return;
    const msg = await d.repo.getMessage(p.workspaceId, p.messageId);
    const collabMeta = msg?.collab ? (typeof msg.collab === "string" ? JSON.parse(msg.collab) : msg.collab) as { taskId?: string } : null;
    // Only a collaborator's own message in this task.
    if (!msg || msg.bot_id !== p.botId || collabMeta?.taskId !== p.taskId || msg.rolled_back_at) return;
    const composed = composeAgentMessage({ text: p.message.text, blocks: p.message.blocks });
    if ("error" in composed) return;
    const row = await d.repo.editMessage(p.workspaceId, p.messageId, { text: composed.text, blocks: composed.blocks });
    if (!row) return;
    const [hydrated] = await d.repo.hydrateMessages(p.workspaceId, botActor(p.botId), [row]);
    await d.publishToChannel(p.workspaceId, p.channelId, { type: "message_edited", channelId: p.channelId, message: hydrated });
  }

  // -- user controls ------------------------------------------------------------------
  /** Stop whatever the collaborators are doing in this channel. */
  async function stop(workspaceId: string, channelId: string): Promise<number> {
    const runs = await store.activeRunsInChannel(channelId);
    for (const r of runs) await sendToArtisan(CANCEL_JOB, workspaceId, { runId: r.id, epoch: r.epoch }, `${r.id}:cancel`);
    return runs.length;
  }

  /**
   * Roll the conversation back to just before `messageId`: later messages are hidden (kept, flagged), runs triggered
   * from there on are undone, and each affected task's collaborator rewinds its session (and optionally its files).
   */
  async function rollbackToBefore(workspaceId: string, channelId: string, messageId: string, restoreFiles: boolean): Promise<{ hidden: number; tasks: number }> {
    const target = await d.repo.getMessage(workspaceId, messageId);
    if (!target || target.channel_id !== channelId) return { hidden: 0, tasks: 0 };
    const fromIso = asIso(target.created_at);

    const undone = await store.runsTriggeredFrom(channelId, fromIso);
    const byTask = new Map<string, typeof undone>();
    for (const r of undone) byTask.set(r.task_id, [...(byTask.get(r.task_id) ?? []), r]);

    for (const [taskId, runs] of byTask) {
      const task = await store.getTask(taskId);
      if (!task) continue;
      const newEpoch = task.epoch + 1;
      const remaining = (await store.liveRuns(taskId)).filter((r) => !runs.some((u) => u.id === r.id));
      // Reopen the task if something of it survives; otherwise it never happened (the next message starts a fresh one).
      await store.patchTask(taskId, { epoch: newEpoch, status: remaining.length ? "open" : "completed", touch: true });
      for (const r of runs) await store.patchRun(r.id, { state: "rolled_back", finished_at: new Date().toISOString() });
      await sendToArtisan(ROLLBACK_JOB, workspaceId, { taskId, newEpoch, fromRunId: runs[0].id, restoreFiles }, `${taskId}:${newEpoch}`);
      void frame(workspaceId, channelId, task.bot_id, taskId, null, "rollback");
    }
    const hidden = await store.hideMessagesFrom(channelId, fromIso);
    // Clients drop what they show past this point.
    const members = await d.repo.memberPayloads(workspaceId, channelId);
    const botId = members.find((m) => m.type === "bot")?.botId ?? "";
    void frame(workspaceId, channelId, botId, null, null, "rollback");
    return { hidden: hidden.length, tasks: byTask.size };
  }

  // -- housekeeping ---------------------------------------------------------------------
  async function sweep(): Promise<void> {
    const closed = await store.closeIdleTasks(TASK_IDLE_MS);
    if (closed) d.log.info({ closed }, "collab: closed idle tasks");
    // A run that never answered by its deadline: tell the user and ask Artisan to stop it.
    for (const run of await store.overdueRuns(60_000)) {
      await store.patchRun(run.id, { state: "failed", finished_at: new Date().toISOString() });
      await sendToArtisan(CANCEL_JOB, run.workspace_id, { runId: run.id, epoch: run.epoch }, `${run.id}:cancel`).catch(() => undefined);
      const result = await d.repo.postMessage({
        workspaceId: run.workspace_id, channelId: run.channel_id, author: botActor(run.bot_id),
        text: "I didn't get back to you in time. The task is still open — message me again and I'll pick it up.",
        collab: { taskId: run.task_id, runId: run.id, sessionId: null, outcome: "failed" },
      });
      if (!("error" in result)) d.publishPosted(run.workspace_id, result.message, result.notifyUserIds, result.notification);
      void frame(run.workspace_id, run.channel_id, run.bot_id, run.task_id, run.id, "failed");
    }
  }

  return { store, onMessagePosted, onAction, handleBot, handleStatus, handleReply, handleEdit, stop, rollbackToBefore, sweep };
}

export type CollabService = ReturnType<typeof createCollabService>;
