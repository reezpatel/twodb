import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Loader2, RefreshCw } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { artisanClient, type InspectSnapshot, type MessageInfo } from "../../lib/artisan-client.js";
import { AgentTrace, formatMs, type SpanKind, type TraceSpan } from "../../components/ui/agent-trace.js";

/* ───────────────────────── data ───────────────────────── */

interface ToolMeta {
  id: string;
  name: string;
  args: string | Record<string, unknown>;
  output?: string | null;
  ok?: boolean | null;
  startedAt?: number | null;
  completedAt?: number | null;
}
interface RequestMeta {
  model?: string;
  effort?: string | null;
  maxTokens?: number;
  messageCount?: number;
  contextChars?: number;
  toolNames?: string[];
}
interface UsageMeta {
  prompt_tokens?: number;
  completion_tokens?: number;
  cached_tokens?: number;
}
interface AssistantMeta {
  toolCalls?: ToolMeta[];
  thinking?: Array<{ text: string; durationMs?: number | null }>;
  usage?: UsageMeta | null;
  round?: number;
  modelStartedAt?: number | null;
  firstTokenAt?: number | null;
  modelEndedAt?: number | null;
  request?: RequestMeta;
  inspectId?: string | null;
}

interface Round {
  index: number;
  message: MessageInfo;
  meta: AssistantMeta;
  prompt: string;
  promptId: string;
  t0: number;
  duration: number;
  spans: TraceSpan[];
  tools: ToolMeta[];
  failed: number;
  model: string | null;
}

const ioTools = new Set(["read_file", "write_file", "edit_file", "update_file", "list_dir", "glob", "grep", "apply_patch"]);
const kindOf = (name: string): SpanKind => (/agent/i.test(name) ? "agent" : ioTools.has(name) ? "io" : "tool");

function parseArgs(a: ToolMeta["args"]): Record<string, unknown> {
  if (typeof a !== "string") return a ?? {};
  try {
    return JSON.parse(a) as Record<string, unknown>;
  } catch {
    return {};
  }
}
function previewOf(args: Record<string, unknown>): string | undefined {
  for (const key of ["command", "path", "pattern", "url", "query", "prompt", "name", "jobId"]) {
    const v = args[key];
    if (typeof v === "string" && v) return v.length > 60 ? `${v.slice(0, 60)}…` : v;
  }
  return undefined;
}

function buildRounds(messages: MessageInfo[]): Round[] {
  const rounds: Round[] = [];
  let prompt = "";
  let promptId = "";
  for (const m of messages) {
    if (m.role === "user") {
      prompt = m.content;
      promptId = m.id;
      continue;
    }
    if (m.role !== "assistant") continue;
    const meta = (m.meta ?? {}) as AssistantMeta;
    const tools = meta.toolCalls ?? [];
    const starts = tools.map((t) => t.startedAt).filter((n): n is number => typeof n === "number");
    const t0 = meta.modelStartedAt ?? (starts.length ? Math.min(...starts) : new Date(m.createdAt).getTime());
    const modelEnd = meta.modelEndedAt != null ? meta.modelEndedAt - t0 : 0;

    const spans: TraceSpan[] = [
      {
        id: "model",
        label: meta.request?.model ?? "model",
        kind: "model",
        start: 0,
        end: modelEnd,
        tokens: meta.usage?.completion_tokens,
        detail: meta.usage ? `${meta.usage.prompt_tokens ?? 0} in` : undefined,
      },
    ];
    let end = modelEnd;
    for (const t of tools) {
      const start = Math.max(0, (t.startedAt ?? t.completedAt ?? t0) - t0);
      const stop = Math.max(start, (t.completedAt ?? t.startedAt ?? t0) - t0);
      end = Math.max(end, stop);
      spans.push({
        id: t.id,
        label: t.name,
        kind: kindOf(t.name),
        start,
        end: stop,
        status: t.ok === false ? "error" : "ok",
        detail: previewOf(parseArgs(t.args)),
      });
    }
    rounds.push({
      index: rounds.length,
      message: m,
      meta,
      prompt,
      promptId,
      t0,
      duration: end,
      spans,
      tools,
      failed: tools.filter((t) => t.ok === false).length,
      model: meta.request?.model ?? null,
    });
  }
  return rounds;
}

/* ───────────────────────── small bits ───────────────────────── */

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtTokens = (n: number | undefined) => (n == null ? "–" : n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const oneLine = (s: string, n = 90) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      aria-label="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
      className="rounded p-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function Section({ title, text, mono = true, empty = "—" }: { title: string; text?: string; mono?: boolean; empty?: string }) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{title}</h4>
        {text ? (
          <span className="ml-auto">
            <CopyBtn text={text} />
          </span>
        ) : null}
      </div>
      {text ? (
        <pre
          className={cn(
            "max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-muted/60 p-3 text-[12px] leading-relaxed text-ink",
            mono ? "font-mono" : "font-sans",
          )}
        >
          {text}
        </pre>
      ) : (
        <p className="text-[12px] italic text-ink-muted/70">{empty}</p>
      )}
    </section>
  );
}

function KV({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-[12px]">
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-ink-muted">{k}</dt>
          <dd className="min-w-0 break-words font-mono text-ink">{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/* ───────────────────────── request snapshot ───────────────────────── */

const ROLE_STYLE: Record<string, string> = {
  system: "bg-warning/15 text-warning",
  user: "bg-info/15 text-info",
  assistant: "bg-success/15 text-success",
  tool: "bg-surface-muted text-ink-muted",
};

function MessageBlock({ m, defaultOpen }: { m: InspectSnapshot["messages"][number]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const calls = m.toolCalls ?? [];
  const body = [m.content ?? "", ...calls.map((c) => `→ ${c.function.name}(${c.function.arguments})`)].filter(Boolean).join("\n\n");
  return (
    <div className="rounded-md bg-surface-muted/40">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-surface-muted/60">
        <ChevronRight className={cn("size-3.5 shrink-0 text-ink-muted transition-transform", open && "rotate-90")} />
        <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] uppercase", ROLE_STYLE[m.role] ?? ROLE_STYLE.tool)}>{m.role}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted">{oneLine(body || "(empty)", 100)}</span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-muted">{body.length.toLocaleString()} ch</span>
      </button>
      {open ? (
        <div className="relative px-2.5 pb-2.5">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-ink">{body || "(empty)"}</pre>
          {body ? <span className="absolute right-3 top-0"><CopyBtn text={body} /></span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** The exact request for a round, loaded on demand (snapshots expire after 3 days). */
function RequestSnapshot({ sessionId, inspectId }: { sessionId: string; inspectId?: string | null }) {
  const [snap, setSnap] = useState<InspectSnapshot | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "expired" | "error">("idle");
  const [showTools, setShowTools] = useState(false);

  useEffect(() => {
    setSnap(null);
    setShowTools(false);
    if (!inspectId) return setState("expired");
    let live = true;
    setState("loading");
    artisanClient
      .getInspectRound(sessionId, inspectId)
      .then((s) => live && (setSnap(s), setState("idle")))
      .catch((e: Error) => live && setState(/expired|not found|404/i.test(e.message) ? "expired" : "error"));
    return () => {
      live = false;
    };
  }, [sessionId, inspectId]);

  const total = snap?.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0) ?? 0;
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Request sent to the model</h4>
        {snap ? (
          <span className="ml-auto font-mono text-[11px] text-ink-muted">
            {snap.messages.length} messages · {total.toLocaleString()} chars
          </span>
        ) : null}
      </div>
      {state === "loading" ? <Loader2 className="size-4 animate-spin text-ink-muted" /> : null}
      {state === "expired" ? (
        <p className="text-[12px] italic text-ink-muted/70">The full request is no longer available — request snapshots are kept for 3 days.</p>
      ) : null}
      {state === "error" ? <p className="text-[12px] text-destructive">Could not load the request.</p> : null}
      {snap ? (
        <div className="space-y-1">
          {snap.messages.map((m, i) => (
            <MessageBlock key={i} m={m} defaultOpen={false} />
          ))}
          <div className="rounded-md bg-surface-muted/40">
            <button type="button" onClick={() => setShowTools((v) => !v)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-surface-muted/60">
              <ChevronRight className={cn("size-3.5 shrink-0 text-ink-muted transition-transform", showTools && "rotate-90")} />
              <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-ink-muted">tools</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted">{snap.tools.length} tool schemas</span>
            </button>
            {showTools ? (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-2.5 pb-2.5 font-mono text-[12px] leading-relaxed text-ink">{JSON.stringify(snap.tools, null, 2)}</pre>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ───────────────────────── span detail ───────────────────────── */

function ModelDetail({ round, sessionId }: { round: Round; sessionId: string }) {
  const { meta, message } = round;
  const req = meta.request;
  const u = meta.usage;
  const ttft = meta.firstTokenAt != null && meta.modelStartedAt != null ? meta.firstTokenAt - meta.modelStartedAt : null;
  const total = meta.modelEndedAt != null && meta.modelStartedAt != null ? meta.modelEndedAt - meta.modelStartedAt : null;
  const thinking = (meta.thinking ?? []).map((t) => t.text).join("\n\n");
  return (
    <div className="space-y-5">
      <section className="space-y-1.5">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Request</h4>
        {req ? (
          <KV
            rows={[
              ["model", req.model ?? "–"],
              ["reasoning effort", req.effort ?? "default"],
              ["max tokens", req.maxTokens ?? "–"],
              ["messages in context", req.messageCount ?? "–"],
              ["context size", req.contextChars != null ? `${req.contextChars.toLocaleString()} chars (~${Math.ceil(req.contextChars / 4).toLocaleString()} tk)` : "–"],
              ["tools offered", req.toolNames?.length ? req.toolNames.join(", ") : "none"],
            ]}
          />
        ) : (
          <p className="text-[12px] italic text-ink-muted/70">Request details were not recorded for this round.</p>
        )}
      </section>

      <RequestSnapshot sessionId={sessionId} inspectId={round.meta.inspectId} />

      <section className="space-y-1.5">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Response</h4>
        <KV
          rows={[
            ["input tokens", fmtTokens(u?.prompt_tokens)],
            ["output tokens", fmtTokens(u?.completion_tokens)],
            ["cached tokens", fmtTokens(u?.cached_tokens)],
            ["time to first token", ttft != null ? formatMs(ttft) : "–"],
            ["model time", total != null ? formatMs(total) : "–"],
            ["tool calls", round.tools.length],
            ["stored at", new Date(message.createdAt).toLocaleString()],
          ]}
        />
      </section>

      {thinking ? <Section title="Reasoning" text={thinking} mono={false} /> : null}
      <Section title="Assistant message" text={message.content} mono={false} empty={round.tools.length ? "No text — the model went straight to tool calls." : "Empty response"} />
    </div>
  );
}

function ToolDetail({ tool, round }: { tool: ToolMeta; round: Round }) {
  const args = parseArgs(tool.args);
  const argsText = Object.keys(args).length ? JSON.stringify(args, null, 2) : typeof tool.args === "string" ? tool.args : "";
  const dur = tool.startedAt != null && tool.completedAt != null ? tool.completedAt - tool.startedAt : null;
  return (
    <div className="space-y-5">
      <section className="space-y-1.5">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Call</h4>
        <KV
          rows={[
            ["tool", tool.name],
            ["call id", tool.id],
            [
              "status",
              tool.ok === false ? <span className="text-destructive">failed</span> : tool.ok === true ? <span className="text-success">succeeded</span> : "no result stored",
            ],
            ["duration", dur != null ? formatMs(dur) : "–"],
            ["offset in round", tool.startedAt != null ? `+${formatMs(Math.max(0, tool.startedAt - round.t0))}` : "–"],
          ]}
        />
      </section>
      <Section title="Arguments (sent by the model)" text={argsText} empty="No arguments" />
      <Section title="Result (returned to the model)" text={tool.output ?? undefined} empty="No output stored" />
    </div>
  );
}

/* ───────────────────────── screens ───────────────────────── */

const COLUMNS = "grid-cols-[2.25rem_minmax(0,1fr)_5rem_5rem_6.5rem_5.5rem]";

function RoundTable({ rounds, onOpen }: { rounds: Round[]; onOpen: (index: number) => void }) {
  return (
    <div className="min-w-[560px] px-4 pb-6">
      <div className={cn("sticky top-0 z-10 grid items-center gap-3 border-b border-outline bg-paper px-3 py-2 text-[11px] uppercase tracking-wide text-ink-muted", COLUMNS)}>
        <span>#</span>
        <span>Activity</span>
        <span className="text-right">Tools</span>
        <span className="text-right">Time</span>
        <span className="text-right">Tokens in/out</span>
        <span className="text-right">Started</span>
      </div>
      {rounds.map((r, i) => {
        const newTurn = i === 0 || rounds[i - 1].promptId !== r.promptId;
        const names = [...new Set(r.tools.map((t) => t.name))];
        const u = r.meta.usage;
        return (
          <Fragment key={r.message.id}>
            {newTurn && r.prompt ? <div className="mt-4 px-3 pb-1 text-[12px] text-ink-muted">“{oneLine(r.prompt, 140)}”</div> : null}
            <button
              type="button"
              onClick={() => onOpen(r.index)}
              className={cn("grid w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-muted", COLUMNS)}
            >
              <span className="font-mono text-[12px] text-ink-muted">{r.index + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-ink">{r.message.content ? oneLine(r.message.content) : names.length ? names.join(", ") : "(empty)"}</span>
                {r.message.content && names.length ? <span className="block truncate font-mono text-[11px] text-ink-muted">{names.join(", ")}</span> : null}
              </span>
              <span className={cn("text-right font-mono text-[12px] tabular-nums", r.failed ? "text-destructive" : "text-ink-muted")}>
                {r.tools.length ? (r.failed ? `${r.tools.length - r.failed}/${r.tools.length}` : r.tools.length) : "–"}
              </span>
              <span className="text-right font-mono text-[12px] tabular-nums text-ink-muted">{r.duration > 0 ? formatMs(r.duration) : "–"}</span>
              <span className="text-right font-mono text-[12px] tabular-nums text-ink-muted">
                {fmtTokens(u?.prompt_tokens)} / {fmtTokens(u?.completion_tokens)}
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums text-ink-muted">{clock(r.message.createdAt)}</span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

function RoundView({ rounds, index, onIndex, onBack, sessionId }: { rounds: Round[]; index: number; onIndex: (i: number) => void; onBack: () => void; sessionId: string }) {
  const round = rounds[index];
  const [selected, setSelected] = useState<string>("model");
  useEffect(() => setSelected("model"), [round.message.id]);

  const tool = round.tools.find((t) => t.id === selected);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 py-2">
        <button type="button" onClick={onBack} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink">
          <ArrowLeft className="size-3.5" /> Rounds
        </button>
        <span className="text-[13px] font-medium text-ink">Round {index + 1}</span>
        <span className="text-[12px] text-ink-muted">of {rounds.length}</span>
        <span className="ml-auto flex items-center gap-0.5">
          <button type="button" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Previous round" className="rounded p-1 text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-30">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" disabled={index >= rounds.length - 1} onClick={() => onIndex(index + 1)} aria-label="Next round" className="rounded p-1 text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-30">
            <ChevronRight className="size-4" />
          </button>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-2 pb-3">
          <AgentTrace spans={round.spans} runId={`round ${index + 1}`} model={round.model ?? undefined} selectedId={selected} onSpanSelect={(s) => setSelected(s.id)} />
        </div>
        <div className="mx-4 mb-8 rounded-lg bg-surface/60 p-4">
          <h3 className="mb-4 text-[13px] font-medium text-ink">{selected === "model" ? "Model call" : `Tool call · ${tool?.name ?? ""}`}</h3>
          {selected === "model" || !tool ? <ModelDetail round={round} sessionId={sessionId} /> : <ToolDetail tool={tool} round={round} />}
        </div>
      </div>
    </div>
  );
}

/**
 * Inspector: a table of every model round in the session; open one for its
 * timeline, then click a span to see exactly what was stored — the request
 * summary and response for the model call, arguments and output for tools.
 */
export function InspectorScreen({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<MessageInfo[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await artisanClient.getSession(sessionId);
      setMessages(d.messages);
      setRunning(d.running);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [sessionId]);

  useEffect(() => {
    setMessages(null);
    setOpen(null);
    void load();
  }, [load]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [running, load]);

  const rounds = useMemo(() => buildRounds(messages ?? []), [messages]);

  if (!messages) {
    return (
      <div className="flex flex-1 items-center justify-center text-ink-muted">
        {error ? <span className="text-[13px] text-destructive">{error}</span> : <Loader2 className="size-5 animate-spin" />}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {open === null ? (
        <>
          <div className="flex shrink-0 items-center gap-2 px-4 py-3">
            <h2 className="text-[13px] font-medium text-ink">Inspector</h2>
            <span className="text-[12px] text-ink-muted">
              {rounds.length} round{rounds.length === 1 ? "" : "s"}
              {running ? " · running" : ""}
            </span>
            <button type="button" onClick={() => void load()} title="Refresh" aria-label="Refresh" className="ml-auto rounded p-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink">
              <RefreshCw className="size-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {rounds.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-ink-muted">No model rounds yet — send a message first.</p>
            ) : (
              <RoundTable rounds={rounds} onOpen={setOpen} />
            )}
          </div>
        </>
      ) : (
        <RoundView rounds={rounds} index={Math.min(open, rounds.length - 1)} onIndex={setOpen} onBack={() => setOpen(null)} sessionId={sessionId} />
      )}
    </div>
  );
}
