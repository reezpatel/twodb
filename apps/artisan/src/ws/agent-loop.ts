import type { AgentRow, SessionRow } from "../db/schema.js";
import { parseJson, type ArtisanRepo } from "../db/repository.js";
import type { DispatchClient } from "../dispatch-client.js";
import type { ChatMessage, TworouteClient, ToolDef } from "../tworoute-client.js";
import type { WorkspaceHub, ServerFrameBody } from "./hub.js";
import { runCompaction } from "./compaction.js";
import { subagentTools } from "./tools/subagents.js";
import { askUserTool } from "./tools/ask-user.js";

/** Invocation matrix — caller agent type (null = main session) → allowed target types. */
const INVOKABLE_BY: Record<string, string[]> = {
  main: ["sub_agent", "persona", "collaborator"],
  sub_agent: ["sub_agent"],
  persona: ["sub_agent", "persona"],
  collaborator: ["sub_agent", "persona", "collaborator"],
};

export const MAX_DEPTH = 3;
export const MAX_ROUNDS = 120;

/** Everything a tool execution gets. */
export interface ToolContext {
  deps: RunDeps;
  repo: ArtisanRepo;
  dispatch: DispatchClient;
  session: SessionRow;
  agent: AgentRow;
  model: string;
  apiKey: string;
  tools: ToolSpec[];
  emit: (frame: ServerFrameBody) => void;
  askUser: (questions: Array<{ question: string; options?: string[]; allowMultiple?: boolean }>) => Promise<{ cancelled: boolean; answers?: Array<string | string[]> }>;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

/** Tools that need no session context (pure). */
/** Job tools may only touch jobs stamped with THIS session's id (the
 *  dispatch resourceId set by job_start) — an agent can't read, feed, or kill
 *  another session's or the user's jobs. */
async function assertJobOwned(ctx: ToolContext, jobId: string): Promise<{ id: string; resourceId: string | null; status: string; exitCode: number | null }> {
  const job = await ctx.dispatch.getJob(jobId);
  if (job.resourceId !== ctx.session.id) {
    throw new Error(`job ${jobId} is not part of this session (jobs are scoped to the session/agent that started them)`);
  }
  return job;
}

function fileTools(dispatch: DispatchClient): ToolSpec[] {
  const run = async (session: SessionRow, command: string, timeoutMs?: number) => {
    const res = await dispatch.exec(session.runner, command, session.directory, timeoutMs);
    if (res.error) throw new Error(res.error);
    if (res.exitCode === -1 && !res.stdout && !res.stderr) {
      throw new Error(`command could not start (exit -1, no output) — does ${session.directory} exist on runner ${session.runner}?`);
    }
    return res;
  };
  return [
    {
      name: "read_file",
      description: "Reads a file's content (first N lines by default; offset/limit for ranges). Path is relative to the session directory.",
      parameters: { type: "object", properties: { path: { type: "string" }, offset: { type: "number" }, limit: { type: "number" } }, required: ["path"] },
      async execute(args, ctx) {
        const offset = Number(args.offset ?? 1);
        const limit = Number(args.limit ?? 2000);
        const res = await run(ctx.session, `awk 'NR>=${offset} && NR<${offset + limit} {print NR\"\\t\"$0}' ${shellQuote(String(args.path))}`);
        return res.stdout || "(empty)";
      },
    },
    {
      name: "write_file",
      description: "Creates or fully overwrites a file with the given content. Parent dirs are created.",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      async execute(args, ctx) {
        const content = String(args.content ?? "");
        const res = await run(ctx.session, `mkdir -p $(dirname ${shellQuote(String(args.path))}) && cat > ${shellQuote(String(args.path))} <<'__ARTISAN_EOF__'\n${content}\n__ARTISAN_EOF__\nwc -c < ${shellQuote(String(args.path))}`);
        return res.stdout.trim() ? `wrote ${res.stdout.trim()} bytes` : "written";
      },
    },
    {
      name: "update_file",
      description: "Replaces an exact string in a file (must match exactly once unless allowMultiple).",
      parameters: { type: "object", properties: { path: { type: "string" }, old: { type: "string" }, new: { type: "string" }, allowMultiple: { type: "boolean" } }, required: ["path", "old", "new"] },
      async execute(args, ctx) {
        const script = `python3 - <<'PYEOF'\nimport sys\np=${JSON.stringify(String(args.path))}\ns=open(p).read()\nold=${JSON.stringify(String(args.old))}\nnew=${JSON.stringify(String(args.new))}\nn=s.count(old)\nif n==0:\n print("NOT_FOUND"); sys.exit(1)\nif n>1 and not ${args.allowMultiple ? "True" : "False"}:\n print(f"AMBIGUOUS:{n}"); sys.exit(1)\nopen(p,"w").write(s.replace(old,new))\nprint(f"replaced {n}")\nPYEOF`;
        const res = await run(ctx.session, script);
        if (res.exitCode !== 0) throw new Error(res.stdout.trim() || res.stderr.trim() || "update failed");
        return res.stdout.trim();
      },
    },
    {
      name: "remove_file",
      description: "Removes a file (or empty directory).",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      async execute(args, ctx) {
        const res = await run(ctx.session, `rm ${shellQuote(String(args.path))} && echo removed`);
        return res.exitCode === 0 ? "removed" : `rm failed: ${res.stderr.trim()}`;
      },
    },
    {
      name: "exec",
      description: "Runs a shell command in the session directory (one-shot, buffered). Output is truncated to 20k chars. Use job_start for long-running commands.",
      parameters: { type: "object", properties: { command: { type: "string" }, timeoutMs: { type: "number", default: 60000 } }, required: ["command"] },
      async execute(args, ctx) {
        const command = String(args.command);
        const timeout = Math.min(Number(args.timeoutMs ?? 60_000), 600_000);
        const res = await ctx.dispatch.exec(ctx.session.runner, command, ctx.session.directory, timeout);
        if (res.error) throw new Error(res.error);
        let out = `${res.stdout}${res.stderr ? `\n(stderr)\n${res.stderr}` : ""}`;
        if (out.length > 20_000) out = `${out.slice(0, 20_000)}\n… truncated (${out.length} chars)`;
        return out || `(no output, exit ${res.exitCode ?? "?"})`;
      },
    },
    {
      name: "job_start",
      description: "Starts a long-running job (dev server, watcher, test suite) in the session directory. Returns the job id — poll with job_logs / job_status; feed stdin with job_input; stop with job_terminate.",
      parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
      async execute(args, ctx) {
        const job = await ctx.dispatch.createJob(ctx.session.runner, String(args.command), ctx.session.directory, ctx.session.id);
        return JSON.stringify({ jobId: job.id, status: job.status });
      },
    },
    {
      name: "job_logs",
      description: "Fetches a job's log lines (optionally after a sequence number). Only jobs started in THIS session are visible.",
      parameters: { type: "object", properties: { jobId: { type: "string" }, after: { type: "number" } }, required: ["jobId"] },
      async execute(args, ctx) {
        await assertJobOwned(ctx, String(args.jobId));
        const res = await ctx.dispatch.jobLogs(String(args.jobId), Number(args.after ?? 0));
        const lines = res.lines.map((l: { line: string }) => l.line).join("\n");
        return lines.slice(0, 20_000) || "(no logs yet)";
      },
    },
    {
      name: "job_status",
      description: "Checks a job's status and exit code.",
      parameters: { type: "object", properties: { jobId: { type: "string" } }, required: ["jobId"] },
      async execute(args, ctx) {
        const job = await assertJobOwned(ctx, String(args.jobId));
        return JSON.stringify({ status: job.status, exitCode: job.exitCode });
      },
    },
    {
      name: "job_input",
      description: "Feeds data (or EOF) to a running job's stdin.",
      parameters: { type: "object", properties: { jobId: { type: "string" }, data: { type: "string" }, eof: { type: "boolean" } }, required: ["jobId"] },
      async execute(args, ctx) {
        await assertJobOwned(ctx, String(args.jobId));
        await ctx.dispatch.jobInput(String(args.jobId), String(args.data ?? ""), Boolean(args.eof));
        return args.eof ? "stdin closed" : "fed";
      },
    },
    {
      name: "job_terminate",
      description: "Terminates a running job (SIGTERM).",
      parameters: { type: "object", properties: { jobId: { type: "string" } }, required: ["jobId"] },
      async execute(args, ctx) {
        await assertJobOwned(ctx, String(args.jobId));
        await ctx.dispatch.terminateJob(String(args.jobId));
        return "terminate sent";
      },
    },
    {
      name: "get_plan",
      description: "Reads this session's current plan (step list with statuses).",
      parameters: { type: "object", properties: {} },
      async execute(_args, ctx) {
        // Read fresh from the DB — ctx.session.plan_json is a snapshot from run
        // start and would miss a plan written earlier in THIS run.
        const row = await ctx.repo.getSession(ctx.session.workspace_id, ctx.session.id);
        const plan = parseJson<unknown>(row?.plan_json ?? null, null);
        return plan ? JSON.stringify(plan) : "no plan set";
      },
    },
    {
      name: "update_plan",
      description: "Replaces the session plan. Pass the FULL step list: [{description, status: pending|in_progress|done}].",
      parameters: {
        type: "object",
        properties: { steps: { type: "array", items: { type: "object", properties: { description: { type: "string" }, status: { type: "string", enum: ["pending", "in_progress", "done"] } }, required: ["description"] } } },
        required: ["steps"],
      },
      async execute(args, ctx) {
        const steps = (args.steps as Array<{ description: string; status?: string }>) ?? [];
        const plan = steps.map((s) => ({ description: s.description, status: s.status === "in_progress" || s.status === "done" ? s.status : "pending" }));
        await ctx.repo.setSessionPlan(ctx.session.id, plan);
        ctx.session.plan_json = JSON.stringify(plan); // keep the in-run snapshot in sync
        ctx.emit({ type: "plan", plan });
        return "plan updated";
      },
    },
    {
      name: "set_session_name",
      description: "Renames this session (shows in the sidebar). Call ONCE the session's goal is clear.",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      async execute(args, ctx) {
        const name = String(args.name).slice(0, 80);
        await ctx.repo.renameSession(ctx.session.workspace_id, ctx.session.id, name);
        ctx.session.title = name;
        ctx.emit({ type: "session_renamed", title: name });
        return "renamed";
      },
    },
    {
      name: "read_skill",
      description: "Reads a skill's full content by name. Skill names are listed in your system prompt.",
      parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      async execute(args, ctx) {
        const skills = await ctx.repo.listSkills(ctx.session.workspace_id, ctx.session.space_id);
        const skill = skills.find((s) => s.name === String(args.name));
        if (!skill) return `no skill named "${args.name}"`;
        return skill.content;
      },
    },
  ];
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

export interface RunDeps {
  repo: ArtisanRepo;
  hub: WorkspaceHub;
  tworoute: TworouteClient;
  dispatch: DispatchClient;
}

/** Sessions currently running — one run per session. */
const running = new Map<string, AbortController>();

export function isSessionRunning(sessionId: string): boolean {
  return running.has(sessionId);
}

export function abortSession(sessionId: string): boolean {
  const ctrl = running.get(sessionId);
  if (!ctrl) return false;
  ctrl.abort();
  return true;
}

export interface AgentFrameEmitter {
  (frame: ServerFrameBody): void;
}

/** The agent loop: streams a completion, executes tools, repeats. */
export async function runAgentLoop(opts: {
  deps: RunDeps;
  session: SessionRow;
  agent: AgentRow;
  model: string;
  apiKey: string;
  userMessage?: string;
  /** Used by subagent runs: emit frames to the parent instead of the room. */
  emitOverride?: AgentFrameEmitter;
}): Promise<void> {
  const { deps, session, agent, model } = opts;
  if (running.has(session.id)) throw new Error("session already running");
  const ctrl = new AbortController();
  running.set(session.id, ctrl);

  const emit: AgentFrameEmitter = opts.emitOverride ?? ((frame) => deps.hub.broadcast(session.workspace_id, session.id, frame));

  try {
    if (opts.userMessage) {
      emit({ type: "run_start" });
    }

    const thread = await deps.repo.currentThread(session.id);
    if (!thread) throw new Error("no open thread");

    // Persist the user message (subagent runs replay their prompt as the system).
    if (opts.userMessage) {
      await deps.repo.addMessage({ threadId: thread.id, sessionId: session.id, role: "user", content: opts.userMessage });
    }

    // Build visible tool list from the agent allowlist.
    const allTools: ToolSpec[] = [
      ...fileTools(deps.dispatch),
      ...subagentTools(),
      askUserTool(),
    ];
    const allow = parseJson<string[]>(agent.tools_json, []);
    const visible = allow.length === 0 ? allTools : allTools.filter((t) => allow.includes(t.name));

    // History: prior threads' summaries + current thread messages.
    const messages = await buildContext(deps, session, agent, visible, thread);

    // max_tokens = the model's own context capacity so reasoning models (e.g. glm)
    // never starve the answer out of the budget. Capped to keep a single turn sane.
    const modelInfo = await deps.tworoute.getModel(model).catch(() => undefined);
    const maxTokens = Math.min(modelInfo?.contextWindow ?? 8192, 32_768);

    let round = 0;
    const roundUsage = { input: 0, output: 0, cached: 0 };
    // Per-round display trace: thinking text + tool results, persisted on the
    // assistant message meta so the UI can replay tool accordions later.
    let roundThinking = "";
    const toolResults = new Map<string, { output: string; ok: boolean; durationMs: number }>();
    const toolStartedAt = new Map<string, number>();

    loop:
    while (round < MAX_ROUNDS) {
      round += 1;
      emit({ type: "round_start", round });

      const toolDefs: ToolDef[] = visible.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));

      const assistantId = `msg_${round}`;
      let content = "";
      const toolCalls: Array<{ id: string; name: string; args: string }> = [];
      let usage: { prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number } | undefined;

      try {
        for await (const chunk of deps.tworoute.streamChat({
          model,
          messages,
          tools: toolDefs.length ? toolDefs : undefined,
          signal: ctrl.signal,
          effort: session.thinking_level ?? null,
          // Reasoning models (e.g. glm) spend budget on reasoning_content and can return
          // empty content when it runs out — size to the model's context capacity.
          maxTokens,
        })) {
          const think = chunk.delta?.reasoning ?? chunk.delta?.reasoning_content;
          if (think) {
            roundThinking += think;
            emit({ type: "thinking_delta", text: think });
          }
          if (chunk.delta?.content) {
            content += chunk.delta.content;
            emit({ type: "delta", messageId: assistantId, text: chunk.delta.content });
          }
          for (const tc of chunk.delta?.tool_calls ?? []) {
            const i = tc.index;
            while (toolCalls.length <= i) toolCalls.push({ id: "", name: "", args: "" });
            if (tc.id) toolCalls[i].id = tc.id;
            if (tc.function?.name) toolCalls[i].name += tc.function.name;
            if (tc.function?.arguments) toolCalls[i].args += tc.function.arguments;
          }
          if (chunk.usage) {
            usage = chunk.usage;
            emit({
              type: "usage",
              usage: {
                inputTokens: roundUsage.input + (chunk.usage.prompt_tokens ?? 0),
                outputTokens: roundUsage.output + (chunk.usage.completion_tokens ?? 0),
                cachedTokens: roundUsage.cached + (chunk.usage.cached_tokens ?? 0),
                calls: round,
                costUsd: null,
              },
            });
          }
        }
      } catch (err) {
        if (ctrl.signal.aborted) {
          emit({ type: "done", ok: false, message: "aborted" });
          break loop;
        }
        throw err;
      }

      if (usage) {
        roundUsage.input += usage.prompt_tokens ?? 0;
        roundUsage.output += usage.completion_tokens ?? 0;
        roundUsage.cached += usage.cached_tokens ?? 0;
      }
      await deps.repo.incrementUsage(session.id, {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        cachedTokens: usage?.cached_tokens ?? 0,
        costUsd: null,
      });
      const usageRow = await deps.repo.getUsage(session.id);
      if (usageRow) {
        emit({
          type: "usage",
          usage: {
            inputTokens: usageRow.input_tokens, outputTokens: usageRow.output_tokens,
            cachedTokens: usageRow.cached_tokens, calls: usageRow.calls, costUsd: usageRow.cost_usd,
          },
        });
      }

      // Persist the assistant message (with tool calls).
      const assistantRow = await deps.repo.addMessage({
        threadId: thread.id, sessionId: session.id, role: "assistant",
        content,
        meta: {
          toolCalls: toolCalls.map((tc) => ({ id: tc.id, name: tc.name, args: tc.args })),
          thinking: roundThinking.trim() ? [{ text: roundThinking, durationMs: null }] : [],
          usage: usage ?? null,
          round,
        },
      });
      roundThinking = "";
      emit({ type: "message_done", messageId: assistantId });

      // Feed back into context.
      messages.push({
        role: "assistant",
        content: content || null,
        tool_calls: toolCalls.length ? toolCalls.map((tc) => ({
          id: tc.id, type: "function" as const, function: { name: tc.name, arguments: tc.args },
        })) : undefined,
      });

      if (toolCalls.length === 0) {
        // No tools — the run is complete.
        await deps.repo.touchSession(session.id);
        emit({ type: "done", ok: true, message: content.slice(0, 200) });
        break loop;
      }

      // Execute tools.
      for (const tc of toolCalls) {
        const tool = visible.find((t) => t.name === tc.name);
        toolStartedAt.set(tc.id, Date.now());
        emit({ type: "tool_start", id: tc.id, name: tc.name, args: safeParse(tc.args) });
        if (!tool) {
          const out = `unknown tool ${tc.name}`;
          emit({ type: "tool_result", id: tc.id, name: tc.name, output: out, ok: false });
          messages.push({ role: "tool", tool_call_id: tc.id, content: out });
          continue;
        }
        const args = safeParse(tc.args);
        try {
          const toolCtx: ToolContext = {
            session, agent, model, deps, emit, apiKey: opts.apiKey,
            dispatch: deps.dispatch, repo: deps.repo,
            tools: visible,
            askUser: async (questions) => {
              if (!session.interactive || deps.hub.roomSize(session.workspace_id, session.id) === 0) {
                return { cancelled: false };
              }
              emit({ type: "ask_user", askId: tc.id, questions });
              return await waitForAnswer(session.id, tc.id);
            },
          };
          const out = await tool.execute(args, toolCtx);
          toolResults.set(tc.id, { output: out.slice(0, 8_000), ok: true, durationMs: Date.now() - (toolStartedAt.get(tc.id) ?? Date.now()) });
          emit({ type: "tool_result", id: tc.id, name: tc.name, output: out.slice(0, 4_000), ok: true });
          messages.push({ role: "tool", tool_call_id: tc.id, content: out.slice(0, 60_000) });
        } catch (err) {
          const out = `tool error: ${(err as Error).message}`;
          toolResults.set(tc.id, { output: out, ok: false, durationMs: Date.now() - (toolStartedAt.get(tc.id) ?? Date.now()) });
          emit({ type: "tool_result", id: tc.id, name: tc.name, output: out, ok: false });
          messages.push({ role: "tool", tool_call_id: tc.id, content: out });
        }
      }

      // Patch tool results/timings into this round's assistant message meta.
      if (toolCalls.length > 0) {
        const patched = toolCalls.map((tc) => {
          const r = toolResults.get(tc.id);
          const started = toolStartedAt.get(tc.id);
          return {
            id: tc.id, name: tc.name, args: tc.args,
            output: r?.output ?? null, ok: r?.ok ?? null,
            startedAt: started ?? null, completedAt: r ? started! + r.durationMs : null,
          };
        });
        await deps.repo.updateMessageContent(assistantRow.id, content, {
          toolCalls: patched,
          thinking: (parseJson<{ thinking?: unknown[] }>(assistantRow.meta_json, {})).thinking ?? [],
          usage: usage ?? null,
          round,
        }).catch(() => {});
        toolResults.clear();
        toolStartedAt.clear();
      }

      // Auto-compaction check.
      const contextChars = messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
      const estTokens = Math.ceil(contextChars / 4);
      const modelInfo = await deps.tworoute.getModel(model).catch(() => undefined);
      const limit = modelInfo?.contextWindow ?? 128_000;
      if (estTokens > limit - 24_000) {
        emit({ type: "status", text: "compacting context…" });
        const summary = await runCompaction(deps, session, model, messages, ctrl.signal);
        emit({ type: "compaction_done", summary });
        messages.length = 0;
        messages.push(...(await buildContext(deps, session, agent, visible, thread)));
      }
    }

    if (round >= MAX_ROUNDS) emit({ type: "done", ok: false, message: "round limit reached" });
  } finally {
    running.delete(session.id);
  }
}

/** Context builder: system prompt (agent instruction + skills) + prior summaries + thread messages. */
async function buildContext(deps: RunDeps, session: SessionRow, agent: AgentRow, tools: ToolSpec[], thread: { id: string; summary: string | null }): Promise<ChatMessage[]> {
  const out: ChatMessage[] = [];

  const skills = await deps.repo.listSkills(session.workspace_id, session.space_id);
  const agentSkillTags = parseJson<string[]>(agent.skill_tags_json, ["default"]);
  const visibleSkills = skills.filter((s) => {
    if (s.directory && s.directory !== session.directory) return false;
    const tags = parseJson<string[]>(s.tags_json, ["default"]);
    return tags.includes("default") || tags.some((t) => agentSkillTags.includes(t));
  });

  const systemParts: string[] = [];
  systemParts.push("You are an expert coding agent operating on a remote machine via tools.");
  systemParts.push(`Working directory: ${session.directory} on runner ${session.runner}. Use relative paths from there.`);
  if (agent.instruction) systemParts.push(`\n## Instructions\n${agent.instruction}`);
  if (session.adhoc_prompt) systemParts.push(`\n## Task\n${session.adhoc_prompt}`);
  if (session.parent_session_id) {
    systemParts.push("\nYou are a headless subagent — you cannot ask the user questions; proceed autonomously and return a final summary as your last message.");
  }
  if (visibleSkills.length) {
    systemParts.push(`\n## Skills\n${visibleSkills.map((s) => `- ${s.name}: ${s.description}`).join("\n")}\n(read_skill <name> for the full content; follow it when relevant)`);
  }
  const plan = parseJson<unknown>(session.plan_json, null);
  if (plan) systemParts.push(`\n## Current plan\n${JSON.stringify(plan)}`);

  // Per-project context files (.agents by default; .claude / AGENTS.md when enabled) —
  // loaded fresh from the runner each run, like pi/earendil-works does.
  const projParts: string[] = [];
  const dirRow = session.directory_id ? await deps.repo.getDirectory(session.workspace_id, session.directory_id) : undefined;
  if (dirRow) {
    const ps = parseJson<{ loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean }>(dirRow.project_settings_json, {});
    const read = async (rel: string) => {
      const res = await deps.dispatch.exec(session.runner, `cat ${shellQuote(rel)} 2>/dev/null`, session.directory, 10_000).catch(() => null);
      return res && res.exitCode === 0 ? res.stdout.trim() : null;
    };
    if (ps.loadAgentsMd !== false) {
      const md = await read("AGENTS.md");
      if (md) projParts.push(`\n## AGENTS.md\n${md}`);
    }
    if (ps.loadAgents !== false) {
      const agents = await read(".agents/AGENTS.md");
      if (agents) projParts.push(`\n## .agents/AGENTS.md\n${agents}`);
    }
    if (ps.loadClaude) {
      const claude = await read(".claude/CLAUDE.md");
      if (claude) projParts.push(`\n## .claude/CLAUDE.md\n${claude}`);
    }
    if (projParts.length) systemParts.push(...projParts);
  }

  out.push({ role: "system", content: systemParts.join("\n") });

  // Prior threads' summaries.
  const threads = await deps.repo.listThreads(session.id);
  for (const t of threads) {
    if (t.id === thread.id) continue;
    if (t.summary) out.push({ role: "system", content: `Context summary from a previous conversation segment:\n${t.summary}` });
  }
  if (thread.summary) out.push({ role: "system", content: `Context summary:\n${thread.summary}` });

  // Current thread messages.
  const rows = await deps.repo.listThreadMessages(thread.id);
  for (const row of rows) {
    if (row.role === "user") out.push({ role: "user", content: row.content });
    else if (row.role === "assistant") {
      const meta = parseJson<{ toolCalls?: Array<{ id: string; name: string; args: string }> }>(row.meta_json, {});
      const calls = meta.toolCalls ?? [];
      out.push({
        role: "assistant",
        content: row.content || null,
        tool_calls: calls.length ? calls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.args } })) : undefined,
      });
    }
    // Tool results are folded below — see toolRows pass.
  }
  // Tool results come as synthetic user rows? No: we persist them only in context, not
  // to the db — the loop pushes them live. For rebuilds, replay is best-effort from
  // assistant + user rows; tool rows are ephemeral per run.
  return out;
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// --- ask_user bridge ---------------------------------------------------------

const pendingAsks = new Map<string, { resolve: (r: { cancelled: boolean; answers?: Array<string | string[]> }) => void }>();

function waitForAnswer(sessionId: string, askId: string): Promise<{ cancelled: boolean; answers?: Array<string | string[]> }> {
  return new Promise((resolve) => {
    pendingAsks.set(`${sessionId}:${askId}`, { resolve });
  });
}

export function resolveAsk(sessionId: string, askId: string, answers: Array<string | string[]>): boolean {
  const entry = pendingAsks.get(`${sessionId}:${askId}`);
  if (!entry) return false;
  pendingAsks.delete(`${sessionId}:${askId}`);
  entry.resolve({ cancelled: false, answers });
  return true;
}

export function cancelAsk(sessionId: string, askId: string): boolean {
  const entry = pendingAsks.get(`${sessionId}:${askId}`);
  if (!entry) return false;
  pendingAsks.delete(`${sessionId}:${askId}`);
  entry.resolve({ cancelled: true });
  return true;
}

