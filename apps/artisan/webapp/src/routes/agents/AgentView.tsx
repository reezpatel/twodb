import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, MessageSquarePlus } from "lucide-react";
import { Button, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, ModelPicker, type ModelEntry, type ModelProvider } from "@twodb/blocks";
import { artisanClient, type AgentInfo, type DirectoryInfo, type ModelInfo, type SessionInfo, type SpaceInfo, type ToolInfo } from "../../lib/artisan-client.js";
import { cn } from "../../lib/cn.js";
import { InlineEdit } from "../../components/ui/inline-edit.js";
import { OvertypeEditor } from "../../components/ui/overtype-editor.js";
import { FolderPicker } from "../shell/partials/FolderPicker.js";
import { SpaceMultiSelect } from "./partials/SpaceMultiSelect.js";
import { MICROVM, RunnerStep, Stepper } from "../shell/partials/DirectoryDialog.js";

type AgentTab = "instruction" | "config" | "sessions";
const TABS: Array<{ id: AgentTab; label: string }> = [
  { id: "instruction", label: "Instruction" },
  { id: "config", label: "Config" },
  { id: "sessions", label: "Sessions" },
];

export interface AgentViewProps {
  agentId: string;
  models: ModelInfo[];
  directories: DirectoryInfo[];
  /** Create a session that runs as this agent and open it. */
  onStartChat: (input: { runner: string; directory: string; directoryId?: string; model: string; agentId: string; spaceId?: string }) => Promise<void>;
  /** Open a session as an app-level tab. */
  onOpenSession: (session: SessionInfo) => void;
  /** Called after any save so the sidebar list refreshes. */
  onChanged: () => void | Promise<void>;
}

/** Agent page: name + description (click to edit) over Instruction / Config / Sessions tabs. */
export function AgentView({ agentId, models, directories, onStartChat, onOpenSession, onChanged }: AgentViewProps) {
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AgentTab>("instruction");

  useEffect(() => {
    setAgent(null);
    setError(null);
    setTab("instruction");
    artisanClient.getAgent(agentId).then(setAgent).catch((e: Error) => setError(e.message));
  }, [agentId]);

  const save = useCallback(
    async (patch: Parameters<typeof artisanClient.updateAgent>[1]) => {
      const next = await artisanClient.updateAgent(agentId, patch);
      setAgent((cur) => ({ ...(cur as AgentInfo), ...next, instruction: next.instruction ?? (patch.instruction ?? cur?.instruction) }));
      void onChanged();
    },
    [agentId, onChanged],
  );

  if (error) return <p className="p-6 text-[13px] text-destructive">{error}</p>;
  if (!agent) return <div className="flex flex-1 items-center justify-center text-ink-muted"><Loader2 className="size-5 animate-spin" /></div>;

  // Directory agents are the per-directory defaults and the llm_chat agent is the single shared chat agent:
  // identity is fixed, and neither has a Sessions tab (their sessions live in the Sessions / Chat sidebar tabs).
  const locked = agent.type === "directory" || agent.type === "llm_chat";
  const tabs = locked ? TABS.filter((t) => t.id !== "sessions") : TABS;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-6 pt-5">
        <div className="flex items-center gap-2">
          <InlineEdit value={agent.name} placeholder="Agent name" required disabled={locked} onSave={(name) => save({ name })} className="text-[18px] font-semibold" />
          <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-ink-muted">{agent.type.replace(/_/g, " ")}</span>
        </div>
        <InlineEdit value={agent.description} placeholder="Add a description — shown to callers" disabled={locked} onSave={(description) => save({ description })} className="mt-0.5 text-[13px] text-ink-muted" />
        <div className="mt-4 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors",
                tab === t.id ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="-mt-px h-px bg-outline/60" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "instruction" ? <InstructionTab key={agent.id} agent={agent} onSave={(instruction) => save({ instruction })} /> : null}
        {tab === "config" ? <ConfigTab key={agent.id} agent={agent} models={models} onSave={save} /> : null}
        {tab === "sessions" && !locked ? <SessionsTab agent={agent} models={models} directories={directories} onStartChat={onStartChat} onOpen={onOpenSession} /> : null}
      </div>
    </div>
  );
}

/* ───────────── instruction ───────────── */

function InstructionTab({ agent, onSave }: { agent: AgentInfo; onSave: (v: string) => Promise<void> }) {
  const [text, setText] = useState(agent.instruction ?? "");
  const [saved, setSaved] = useState(agent.instruction ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = text !== saved;
  const saveRef = useRef<() => Promise<void>>(async () => {});

  const save = async () => {
    if (!dirty || busy) return;
    setBusy(true);
    setErr(null);
    try { await onSave(text); setSaved(text); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  saveRef.current = save;
  return (
    <div className="flex h-full min-h-[24rem] flex-col gap-3 px-6 py-4">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[12px] text-ink-muted">
          {agent.type === "llm_chat" ? "The system prompt for every chat. It is added to each message, after the global instruction." : "The system prompt for this agent. It is added to every request it handles, after the built-in tool guidance."}
        </p>
        <span className="shrink-0 font-mono text-[11px] text-ink-muted">{text.length.toLocaleString()} chars</span>
        <Button size="sm" variant="primary" disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} {dirty ? "Save" : "Saved"}
        </Button>
      </div>
      {err ? <p className="text-[12px] text-destructive">{err}</p> : null}
      <OvertypeEditor
        value={saved}
        onChange={setText}
        onSave={() => void saveRef.current()}
        ariaLabel="Agent instruction"
        placeholder={"You are a careful code reviewer.\n\nWhen you are given a diff…"}
        className="min-h-[20rem] flex-1 overflow-hidden rounded-lg bg-surface-muted/50"
      />
    </div>
  );
}

/* ───────────── config ───────────── */

function ConfigTab({ agent, models, onSave }: { agent: AgentInfo; models: ModelInfo[]; onSave: (p: { tools?: string[]; model?: string | null; runner?: string | null; directory?: string | null; spaceIds?: string[] }) => Promise<void> }) {
  const [catalog, setCatalog] = useState<ToolInfo[] | null>(null);
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);
  const [tools, setTools] = useState<string[]>(agent.tools);
  const [model, setModel] = useState<string | null>(agent.model);
  const [runner, setRunner] = useState<string | null>(agent.runner);
  const [directory, setDirectory] = useState<string | null>(agent.directory);
  const [spaceIds, setSpaceIds] = useState<string[]>(agent.spaceIds?.length ? agent.spaceIds : [agent.spaceId]);
  const fixed = agent.type === "directory";
  const chat = agent.type === "llm_chat"; // shared chat agent: model + tools; its runner is each chat's own microVM, and it spans every space
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    artisanClient.listTools().then(setCatalog).catch(() => setCatalog([]));
    artisanClient.listSpaces().then(setSpaces).catch(() => setSpaces([]));
  }, []);

  const allNames = useMemo(() => (catalog ?? []).map((t) => t.name), [catalog]);
  const allTools = tools.length === 0;
  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  const dirty = !sameSet(tools, agent.tools) || model !== agent.model || runner !== agent.runner || directory !== agent.directory || !sameSet([...spaceIds].sort(), [...(agent.spaceIds?.length ? agent.spaceIds : [agent.spaceId])].sort());

  const providers = useMemo<ModelProvider[]>(() => {
    const byConn = new Map<string, ModelEntry[]>();
    for (const m of models) {
      const list = byConn.get(m.connection) ?? [];
      list.push({ id: m.id, label: m.name, context: m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k` : undefined, triggerLabel: m.id, thinking: m.thinking });
      byConn.set(m.connection, list);
    }
    return [...byConn.entries()].map(([n, ms]) => ({ id: n, title: n, models: ms }));
  }, [models]);

  const toggleTool = (name: string) => setTools((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSave(chat ? { tools, model } : fixed ? { tools, model } : { tools, model, runner, directory, spaceIds });
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const row = "flex items-center justify-between gap-4 py-3";
  const pinned = Boolean(runner);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-5">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-[12px] text-ink-muted">Changes apply to the next run of this agent.</p>
        {err ? <span className="text-[12px] text-destructive">{err}</span> : null}
        <Button size="sm" variant="primary" disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : flash ? <Check className="size-3.5" /> : null} {flash ? "Saved" : "Save changes"}
        </Button>
      </div>

      <section>
        <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Model & runtime</h3>
        <div className="divide-y divide-outline/40">
          <div className={row}>
            <div>
              <div className="text-[13px] text-ink">Model</div>
              <div className="text-[12px] text-ink-muted">{model ? (chat ? "Default model for new chats." : "Always uses this model.") : chat ? "New chats use the first available model." : "Uses the calling session's model."}</div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                <Checkbox checked={model === null} onCheckedChange={(v) => setModel(v ? null : (models[0]?.id ?? null))} /> {chat ? "first available" : "inherit"}
              </label>
              {model !== null && providers.length > 0 ? <ModelPicker providers={providers} value={model} onChange={setModel} /> : null}
            </div>
          </div>

          {chat ? null : <div className={row}>
            <div className="min-w-0">
              <div className="text-[13px] text-ink">Runner & directory</div>
              <div className="truncate font-mono text-[12px] text-ink-muted">{pinned ? `${runner}:${directory ?? "—"}` : "Inherited from the calling session."}</div>
            </div>
            {fixed ? (
              <span className="shrink-0 text-[12px] text-ink-muted">fixed for directory agents</span>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                {pinned ? <Button size="sm" variant="ghost" onClick={() => { setRunner(null); setDirectory(null); }}>Inherit</Button> : null}
                <Button size="sm" variant="secondary" onClick={() => setPinOpen(true)}>{pinned ? "Change…" : "Pin…"}</Button>
              </div>
            )}
          </div>}

          {chat ? null : <div className={row}>
            <div className="shrink-0">
              <div className="text-[13px] text-ink">Spaces</div>
              <div className="text-[12px] text-ink-muted">{fixed ? "Fixed for directory agents." : "Visible in every space you select."}</div>
            </div>
            <SpaceMultiSelect spaces={spaces} value={spaceIds} onChange={setSpaceIds} disabled={fixed} />
          </div>}
        </div>
      </section>

      {chat ? (
        <p className="text-[12px] text-ink-muted">
          Each chat runs in its own microVM (working directory /app). It boots the first time the agent calls a tool, goes idle when unused and resumes on the next call. This one agent is used by chats in every space.
        </p>
      ) : null}

      <section>
        <div className="mb-1 flex items-center gap-3">
          <h3 className="flex-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">Tools</h3>
          <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <Checkbox checked={allTools} onCheckedChange={(v) => setTools(v ? [] : allNames)} /> all tools
          </label>
        </div>
        <p className="mb-2 text-[12px] text-ink-muted">{allTools ? "This agent can use every tool." : `This agent can use ${tools.length} of ${allNames.length} tools.`}</p>
        {!catalog ? <Loader2 className="size-4 animate-spin text-ink-muted" /> : null}
        <ul className="grid gap-px">
          {(catalog ?? []).map((t) => {
            const on = allTools || tools.includes(t.name);
            return (
              <li key={t.name}>
                <label className={cn("flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-muted/60", allTools && "cursor-default opacity-70")}>
                  <Checkbox className="mt-0.5" checked={on} disabled={allTools} onCheckedChange={() => toggleTool(t.name)} />
                  <span className="min-w-0">
                    <span className="block font-mono text-[12px] text-ink">{t.name}</span>
                    <span className="block text-[12px] leading-snug text-ink-muted">{t.description}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {pinOpen ? (
        <PinDialog
          initialRunner={runner ?? ""}
          onClose={() => setPinOpen(false)}
          onPick={(r, d) => { setRunner(r); setDirectory(d); setPinOpen(false); }}
        />
      ) : null}
    </div>
  );
}

function PinDialog({ initialRunner, onPick, onClose }: { initialRunner: string; onPick: (runner: string, dir: string) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [runner, setRunner] = useState(initialRunner);
  const [path, setPath] = useState<string | null>(null);
  const onPickPath = useCallback((p: string | null) => setPath(p), []);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Pin runner & directory</DialogTitle></DialogHeader>
        <Stepper step={step} steps={["Runner", "Directory"]} onJump={setStep} />
        <div className="min-h-[22rem] py-1">
          {step === 0 ? <RunnerStep runner={runner} onSelect={(r) => { if (r !== runner) setPath(null); setRunner(r); }} /> : (
            <FolderPicker key={runner} runner={runner} startPath={runner.startsWith(MICROVM) ? "/app" : "~"} onChange={onPickPath} className="h-[20rem]" />
          )}
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {step === 0 ? (
            <Button disabled={!runner} onClick={() => setStep(1)}>Next</Button>
          ) : (
            <Button disabled={!path} onClick={() => path && onPick(runner, path)}>Use this folder</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── sessions ───────────── */

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function SessionsTab({ agent, models, directories, onStartChat, onOpen }: {
  agent: AgentInfo;
  models: ModelInfo[];
  directories: DirectoryInfo[];
  onStartChat: AgentViewProps["onStartChat"];
  onOpen: (s: SessionInfo) => void;
}) {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [dirId, setDirId] = useState("");
  const [busy, setBusy] = useState(false);
  const [startErr, setStartErr] = useState<string | null>(null);

  useEffect(() => {
    artisanClient.listSessions({ agentId: agent.id, archived: "include" }).then(setSessions).catch((e: Error) => setErr(e.message));
  }, [agent.id]);
  useEffect(() => {
    if (!dirId && directories[0]) setDirId(directories[0].id);
  }, [directories, dirId]);

  const pinned = Boolean(agent.runner && agent.directory);
  const start = async () => {
    setStartErr(null);
    // Pinned agents run where they are pinned; others run in a directory you choose.
    const dir = pinned ? directories.find((d) => d.runner === agent.runner && d.path === agent.directory) : directories.find((d) => d.id === dirId);
    const runner = pinned ? agent.runner! : dir?.runner;
    const directory = pinned ? agent.directory! : dir?.path;
    const model = agent.model ?? dir?.defaultModel ?? models[0]?.id ?? "";
    if (!runner || !directory) return setStartErr("Pick a directory to run in.");
    if (!model) return setStartErr("No model is available.");
    setBusy(true);
    try {
      await onStartChat({ runner, directory, directoryId: dir?.id, model, agentId: agent.id, spaceId: dir?.spaceId ?? agent.spaceId });
    } catch (e) {
      setStartErr((e as Error).message);
      setBusy(false);
    }
  };
  const onNew = () => (pinned ? void start() : setPicking((v) => !v));

  const header = (
    <div className="flex items-center gap-3 px-3 pb-2">
      <p className="min-w-0 flex-1 text-[12px] text-ink-muted">
        {pinned ? <>Chats with this agent run in <span className="font-mono text-ink">{agent.runner}:{agent.directory}</span>.</> : "This agent runs in the directory you pick for each chat."}
      </p>
      <Button size="sm" variant="primary" disabled={busy || (!pinned && directories.length === 0)} onClick={onNew}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MessageSquarePlus className="size-3.5" />} New chat
      </Button>
    </div>
  );

  const picker = picking && !pinned ? (
    <div className="mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-muted/40 px-3 py-2.5">
      <span className="text-[12px] text-ink-muted">Run in</span>
      <select value={dirId} onChange={(e) => setDirId(e.target.value)} className="h-8 min-w-0 flex-1 rounded-md bg-surface-muted px-2 text-[13px] text-ink outline-none focus:ring-1 focus:ring-outline-strong">
        {directories.map((d) => <option key={d.id} value={d.id}>{d.title} — {d.runner}:{d.path}</option>)}
      </select>
      <Button size="sm" variant="primary" disabled={busy || !dirId} onClick={() => void start()}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Start chat
      </Button>
    </div>
  ) : null;

  const notices = (
    <>
      {!pinned && directories.length === 0 ? <p className="px-3 pb-2 text-[12px] text-warning">Add a directory first — chats need somewhere to run.</p> : null}
      {startErr ? <p className="px-3 pb-2 text-[12px] text-destructive">{startErr}</p> : null}
    </>
  );

  if (err) return <p className="px-6 py-4 text-[13px] text-destructive">{err}</p>;
  if (!sessions) return <div className="flex justify-center py-10"><Loader2 className="size-4 animate-spin text-ink-muted" /></div>;
  return (
    <div className="mx-auto max-w-3xl px-4 py-3">
      {header}
      {picker}
      {notices}
      {sessions.length === 0 ? (
        <p className="px-6 py-10 text-center text-[13px] text-ink-muted">No chats with this agent yet. Start one to put it to work.</p>
      ) : (
        sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onOpen(s)}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface-muted"
          >
            <span className="min-w-0">
              <span className={cn("block truncate text-[13px]", s.archivedAt ? "text-ink-muted" : "text-ink")}>{s.title}</span>
              <span className="block truncate font-mono text-[11px] text-ink-muted">{s.runner}:{s.directory} · {s.model}</span>
            </span>
            <span className="text-[11px] text-ink-muted">
              {s.parentSessionId ? "subagent · " : ""}{s.archivedAt ? "archived · " : ""}{ago(s.updatedAt)}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
