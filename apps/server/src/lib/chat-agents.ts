import type { Selectable } from "kysely";
import { db } from "../auth";
import type { AgentTable, ChatChannelTable } from "../plugins/db";
import type { AgentMessage } from "../lib/agent";
import { CHAT_GUIDANCE } from "../lib/system-prompt";
import { startSessionRun } from "../routes/code-ws";
import { broadcastChatEvent } from "../routes/chat-ws";
import { logger } from "./logger";

// Chat agent orchestration: resolves which agents respond to a chat message,
// drives each via its dedicated code_session (one per channel × agent), and
// lands the final answer back in the channel as a chat_message.

const HISTORY_WINDOW = 80;

export interface ChatResponder {
  agent: Selectable<AgentTable>;
  reason: "mention" | "reply" | "assistant";
}

interface ChatWindowRow {
  id: string;
  authorType: string;
  userId: string | null;
  agentId: string | null;
  body: string;
  meta: Record<string, unknown> | null;
  replyToId: string | null;
}

export interface ChatMessageActor {
  id: string;
  name: string;
}

/** Agents with an enabled org connection, keyed by id — the responder pool. */
async function eligibleAgents(organizationId: string): Promise<Map<string, Selectable<AgentTable>>> {
  const agents = await db
    .selectFrom("agent")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("agent.type", "in", ["collaborator", "sentinel"])
    .execute();
  const connections = await db
    .selectFrom("llm_connection")
    .select("provider")
    .where("organizationId", "=", organizationId)
    .where("enabled", "=", true)
    .execute();
  const providers = new Set(connections.map((c) => c.provider));
  return new Map(agents.filter((a) => providers.has(a.provider)).map((a) => [a.id, a]));
}

/** The org's single sentinel agent (one per org is enforced elsewhere). */
export async function findSentinel(organizationId: string): Promise<Selectable<AgentTable> | undefined> {
  return db.selectFrom("agent").selectAll().where("organizationId", "=", organizationId).where("type", "=", "sentinel").executeTakeFirst();
}

/**
 * Which agents should answer: assistant channels always wake the sentinel;
 * normal channels wake @mentioned agents, the author of a replied-to agent
 * message, and the sentinel only when @mentioned.
 */
export async function resolveResponders(
  organizationId: string,
  channel: Selectable<ChatChannelTable>,
  mentions: { type: string; id: string }[],
  replyTarget: ChatWindowRow | null,
): Promise<ChatResponder[]> {
  const pool = await eligibleAgents(organizationId);
  const picked = new Map<string, ChatResponder["reason"]>();

  if (channel.kind === "assistant") {
    const sentinel = await findSentinel(organizationId);
    if (sentinel && pool.has(sentinel.id)) picked.set(sentinel.id, "assistant");
  } else {
    for (const m of mentions) if (m.type === "agent" && pool.has(m.id)) picked.set(m.id, "mention");
    if (replyTarget?.authorType === "agent" && replyTarget.agentId && pool.has(replyTarget.agentId)) {
      picked.set(replyTarget.agentId, "reply");
    }
  }

  return [...picked.entries()].map(([id, reason]) => ({ agent: pool.get(id)!, reason }));
}

function agentDisplayName(agent: Selectable<AgentTable>): string {
  return agent.name ?? agent.description ?? agent.type;
}

function actorName(row: ChatWindowRow, agents: Map<string, Selectable<AgentTable>>, users: Map<string, string>): string {
  if (row.authorType === "agent" && row.agentId) {
    const agent = agents.get(row.agentId);
    return agent ? agentDisplayName(agent) : "agent";
  }
  return users.get(row.userId ?? "") ?? "someone";
}

/** Project chat rows into model history: own turns are assistant, everything else user. */
function projectChatHistory(
  rows: ChatWindowRow[],
  agentId: string,
  agents: Map<string, Selectable<AgentTable>>,
  users: Map<string, string>,
): AgentMessage[] {
  return rows.map((row) => {
    const own = row.authorType === "agent" && row.agentId === agentId;
    const name = actorName(row, agents, users);
    const attachments = ((row.meta?.attachments ?? []) as { filename: string; uri?: string }[]).map((a) => ` [attached: ${a.filename}${a.uri ? ` (${a.uri})` : ""}]`).join("");
    const reply = row.replyToId ? " (replying to an earlier message)" : "";
    return {
      role: own ? ("assistant" as const) : ("user" as const),
      content: own ? row.body : `[${name}]${reply}: ${row.body}${attachments}`,
      meta: null,
    };
  });
}

/** Find or lazily create the per-(channel × agent) code session. */
async function findOrCreateChatSession(organizationId: string, channel: Selectable<ChatChannelTable>, agent: Selectable<AgentTable>) {
  const existing = await db
    .selectFrom("code_session")
    .selectAll()
    .where("organizationId", "=", organizationId)
    .where("chatChannelId", "=", channel.id)
    .where("agentId", "=", agent.id)
    .where("type", "=", "chat")
    .executeTakeFirst();
  if (existing) return existing;

  const now = new Date();
  return db
    .insertInto("code_session")
    .values({
      id: crypto.randomUUID(),
      organizationId,
      title: `chat: #${channel.name} — ${agentDisplayName(agent)}`,
      connectionId: null,
      model: null,
      codeDirectoryId: null,
      type: "chat",
      parentSessionId: null,
      agentId: agent.id,
      mode: null,
      thinkingLevel: null,
      runtimeState: null,
      plan: null,
      locked: undefined,
      interactive: false,
      depthCount: undefined,
      unseenUpdates: undefined,
      chatChannelId: channel.id,
      tags: [],
      createdAt: now,
      updatedAt: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export interface TriggerChatRunsInput {
  organizationId: string;
  channel: Selectable<ChatChannelTable>;
  responders: ChatResponder[];
  /** The just-persisted user message (already in the window when reloaded). */
  userMessageId: string;
  /** Attachment refs (media ids) on the triggering message. */
  attachments: { mediaId: string; filename: string; contentType: string | null }[];
}

export interface TriggerChatRunsResult {
  triggered: { agentId: string; reason: ChatResponder["reason"] }[];
  failures: { agentId: string; error: string }[];
}

/**
 * Fire-and-forget: drive every responder's session to completion, then post
 * the final answer back into the channel. Never throws — failures surface as
 * ws error frames.
 */
export async function triggerChatRuns(input: TriggerChatRunsInput): Promise<TriggerChatRunsResult> {
  const { organizationId, channel, responders } = input;
  const triggered: TriggerChatRunsResult["triggered"] = [];
  const failures: TriggerChatRunsResult["failures"] = [];

  void Promise.allSettled(
    responders.map(async (responder) => {
      const { agent } = responder;
      const agentName = agentDisplayName(agent);
      try {
        const session = await findOrCreateChatSession(organizationId, channel, agent);
        logger.info({ channelId: channel.id, agentId: agent.id, sessionId: session.id, reason: responder.reason }, "chat agent triggered");
        if ((await import("../routes/code-ws")).isSessionRunning(session.id)) {
          logger.warn({ channelId: channel.id, agentId: agent.id }, "chat agent busy — run skipped");
          failures.push({ agentId: agent.id, error: "busy" });
          broadcastChatEvent(organizationId, { type: "agent_state", channelId: channel.id, agentId: agent.id, state: "error", detail: "already responding" });
          return;
        }

        // Fresh window incl. the just-persisted user message.
        const rows = (await db
          .selectFrom("chat_message")
          .select(["id", "authorType", "userId", "agentId", "body", "meta", "replyToId"])
          .where("channelId", "=", channel.id)
          .where("deletedAt", "is", null)
          .orderBy("createdAt", "desc")
          .limit(HISTORY_WINDOW)
          .execute()) as ChatWindowRow[];
        rows.reverse();

        const agentRows = await db.selectFrom("agent").selectAll().where("organizationId", "=", organizationId).execute();
        const agents = new Map(agentRows.map((a) => [a.id, a]));
        const memberRows = await db
          .selectFrom("member")
          .innerJoin("user", "user.id", "member.userId")
          .select(["member.userId", "user.name"])
          .where("member.organizationId", "=", organizationId)
          .execute();
        const users = new Map(memberRows.map((m) => [m.userId, m.name]));
        const history = projectChatHistory(rows.filter((r) => r.id !== input.userMessageId), agent.id, agents, users);

        const connection = await db
          .selectFrom("llm_connection")
          .selectAll()
          .where("organizationId", "=", organizationId)
          .where("provider", "=", agent.provider)
          .where("enabled", "=", true)
          .executeTakeFirst();
        if (!connection) throw new Error("no_enabled_connection");

        // Image attachments ride the vision path; other files are noted in the turn text.
        const assets: { uri: string; filename: string; contentType: string }[] = [];
        const fileNotes: string[] = [];
        for (const a of input.attachments) {
          const uri = `twodb://${connection.id}/${a.mediaId}`;
          if ((a.contentType ?? "").startsWith("image/")) assets.push({ uri, filename: a.filename, contentType: a.contentType! });
          else fileNotes.push(`[attached file: ${a.filename} — read it with read_asset ${uri}]`);
        }

        const triggering = rows.find((r) => r.id === input.userMessageId);
        const userTurn = [
          triggering ? triggering.body : "",
          fileNotes.length ? `\n${fileNotes.join("\n")}` : "",
        ]
          .join("")
          .trim();

        const memberList = [...agents.values()].filter((a) => a.type === "collaborator" || a.type === "sentinel").map((a) => agentDisplayName(a));
        const systemPrompt = [agent.instruction, CHAT_GUIDANCE, `Your display name in this chat: ${agentName}.`, `Channel: #${channel.name}.`, `Other participants: ${memberList.filter((n) => n !== agentName).join(", ") || "just you and humans"}.`]
          .filter(Boolean)
          .join("\n\n");

        broadcastChatEvent(organizationId, { type: "agent_state", channelId: channel.id, agentId: agent.id, state: "thinking" });
        triggered.push({ agentId: agent.id, reason: responder.reason });

        const started = await startSessionRun(organizationId, session, userTurn, {
          connectionId: connection.id,
          model: agent.model,
          thinkingLevel: null,
          userMeta: { chat: { channelId: channel.id, agentId: agent.id } },
          historyOverride: history,
          systemPromptOverride: systemPrompt,
          titleLocked: true,
          assets,
          onFrame: (frame) => {
            if (frame.type === "tool_start") {
              broadcastChatEvent(organizationId, { type: "agent_state", channelId: channel.id, agentId: agent.id, state: "working", detail: frame.name });
            }
          },
        });
        if ("error" in started) throw new Error(started.error);
        if ("busy" in started) throw new Error("busy");

        const answer = await db
          .selectFrom("code_session_message")
          .select("content")
          .where("sessionId", "=", session.id)
          .where("role", "=", "assistant")
          .orderBy("createdAt", "desc")
          .executeTakeFirst();
        const body = answer?.content?.trim();
        if (!body) throw new Error("empty_answer");

        const now = new Date();
        const message = await db
          .insertInto("chat_message")
          .values({
            id: crypto.randomUUID(),
            organizationId,
            channelId: channel.id,
            authorType: "agent",
            userId: null,
            agentId: agent.id,
            body,
            meta: { sessionRef: session.id },
            replyToId: null,
            editedAt: null,
            deletedAt: null,
            createdAt: now,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await db.updateTable("chat_channel").set({ lastMessageAt: now, updatedAt: now }).where("id", "=", channel.id).execute();
        broadcastChatEvent(organizationId, { type: "message", channelId: channel.id, message });
        broadcastChatEvent(organizationId, { type: "agent_state", channelId: channel.id, agentId: agent.id, state: "done" });
      } catch (e) {
        const detail = (e as Error).message?.slice(0, 200) || "run_failed";
        logger.error({ channelId: channel.id, agentId: agent.id, err: e }, "chat agent run failed");
        failures.push({ agentId: agent.id, error: detail });
        broadcastChatEvent(organizationId, { type: "agent_state", channelId: channel.id, agentId: agent.id, state: "error", detail });
      }
    }),
  );

  return { triggered, failures };
}
