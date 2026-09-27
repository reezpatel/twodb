import { useState } from "react";
import { ArrowUp, AtSign, FolderPlus, Loader2, Paperclip, Wrench } from "lucide-react";
import type { useChatPanel, SessionStats } from "./use-chat-panel";
import { useConnectionPicker } from "./use-connection-picker";
import { TOOL_SCREENS, BranchScreen, TerminalScreen, CheckpointsScreen, ChangesScreen, type ScreenId } from "./mock-screens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const selectClasses =
  "border-input bg-background focus:border-ring focus:ring-ring/50 h-8 rounded-md border px-2 text-sm shadow-xs focus:outline-none disabled:opacity-50 max-w-56";

function ToolBlock({ name, args, output, running }: { name: string; args?: Record<string, unknown>; output?: string; running?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasOutput = output !== undefined && output !== "";
  return (
    <div className="bg-muted/60 rounded-lg border text-xs">
      <button className="hover:bg-accent/50 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-mono" onClick={() => setExpanded((v) => !v)}>
        {running ? <Loader2 size={12} className="text-primary animate-spin" aria-hidden="true" /> : <Wrench size={12} aria-hidden="true" />}
        <span className="font-medium">{name}</span>
        {typeof args?.command === "string" && <span className="text-muted-foreground truncate">· {args.command}</span>}
        {hasOutput && <span className="text-muted-foreground/70 ml-auto shrink-0 text-[11px]">{expanded ? "hide" : "output"}</span>}
      </button>
      {expanded && hasOutput && <pre className="border-t text-muted-foreground max-h-40 overflow-y-auto border-t px-3 py-2 whitespace-pre-wrap">{output}</pre>}
    </div>
  );
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function StatsRow({ stats, contextWindow }: { stats: SessionStats; contextWindow: number | null }) {
  const cachePct = stats.inputTokens > 0 ? Math.round((stats.cachedTokens / stats.inputTokens) * 100) : null;
  const ctxPct = contextWindow && contextWindow > 0 ? Math.min(100, Math.round((stats.contextTokens / contextWindow) * 100)) : null;

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs">
      <span title="Input tokens (incl. cached)">↑ {fmtTokens(stats.inputTokens)}</span>
      <span title="Output tokens">↓ {fmtTokens(stats.outputTokens)}</span>
      <span title="Cache hit — cached input / total input">⚡ {cachePct !== null ? `${cachePct}%` : "—"}</span>
      <span title="Generation speed">{stats.tokPerSec !== null ? `${stats.tokPerSec} tok/s` : "—"}</span>
      <span className="flex min-w-40 items-center gap-2" title="Context consumed vs the model's context window">
        <Progress
          value={ctxPct ?? 0}
          className={cn(
            "h-1.5 w-24",
            ctxPct !== null && ctxPct >= 95
              ? "[&>[data-slot=indicator]]:bg-destructive"
              : ctxPct !== null && ctxPct >= 80
                ? "[&>[data-slot=indicator]]:bg-warning"
                : "",
          )}
        />
        <span>
          {fmtTokens(stats.contextTokens)}
          {contextWindow ? ` / ${fmtTokens(contextWindow)}` : ""}
        </span>
      </span>
    </div>
  );
}

function Message({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isUser ? "text-primary" : "text-muted-foreground")}>
        {isUser ? "You" : "Agent"}
      </span>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
    </div>
  );
}

export function ChatPanel({ sessionId, chat }: { sessionId: string | null; chat: ReturnType<typeof useChatPanel> }) {
  const {
    session,
    draft,
    setDraft,
    streaming,
    liveTools,
    error,
    wsStatus,
    runners,
    directories,
    statusText,
    optimistic,
    stats,
    setDirectory,
    createDirectory,
    send,
  } = chat;
  const [newDirOpen, setNewDirOpen] = useState(false);
  const [dirName, setDirName] = useState("");
  const [dirCwd, setDirCwd] = useState("");
  const [dirRunner, setDirRunner] = useState("");

  const [connectionId, setConnectionId] = useState("");
  const [model, setModel] = useState("");
  const [screen, setScreen] = useState<ScreenId>("code");
  const { connections, selected, models, effectiveModel } = useConnectionPicker(connectionId, model);
  const contextWindow = models.find((m) => m.modelId === (model || effectiveModel))?.contextWindow ?? null;

  if (!sessionId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Select a session on the left, or start a new one with +.</p>
      </div>
    );
  }

  const messages = session.data?.messages ?? [];
  const running = streaming !== null;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="bg-card border-b flex items-center gap-1 border-b px-2 py-1">
        {TOOL_SCREENS.map((tool) => (
          <button
            key={tool.id}
            className={cn(
              "text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
              screen === tool.id && "bg-accent text-foreground font-medium",
            )}
            onClick={() => setScreen(tool.id)}
          >
            <tool.icon size={13} aria-hidden="true" />
            {tool.label}
          </button>
        ))}
        <Badge variant={wsStatus === "open" ? "success" : "secondary"} className="ml-auto" title={`Chat socket: ${wsStatus}`}>
          {wsStatus === "open" ? "live" : wsStatus}
        </Badge>
      </div>

      {screen !== "code" ? (
        screen === "branch" ? (
          <BranchScreen />
        ) : screen === "terminal" ? (
          <TerminalScreen />
        ) : screen === "checkpoints" ? (
          <CheckpointsScreen />
        ) : (
          <ChangesScreen />
        )
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((m) => {
                if (m.role === "tool") {
                  const meta = m.meta as { name?: string } | null;
                  return <ToolBlock key={m.id} name={meta?.name ?? "tool"} output={m.content} />;
                }
                const meta = m.meta as { toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[] } | null;
                return (
                  <div key={m.id} className="flex flex-col gap-2">
                    {m.content && <Message role={m.role} content={m.content} />}
                    {meta?.toolCalls?.map((tc) => (
                      <ToolBlock key={tc.id} name={tc.name} args={tc.arguments} />
                    ))}
                  </div>
                );
              })}
              {optimistic && <Message role="user" content={optimistic.content} />}
              {running && (
                <div className="flex flex-col gap-2">
                  {liveTools.map((t) => (
                    <ToolBlock key={t.id} name={t.name} args={t.args} output={t.output} running={!t.done} />
                  ))}
                  {streaming ? (
                    <Message role="assistant" content={streaming} />
                  ) : (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" /> thinking
                    </div>
                  )}
                </div>
              )}
              {running && statusText && (
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 size={12} className="animate-spin" /> {statusText}
                </div>
              )}
              {error && (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="bg-card border-t mx-auto flex w-full max-w-3xl flex-col gap-2 border-t p-3">
            <div className="flex items-center gap-2">
              <select className={selectClasses} value={selected?.id ?? ""} onChange={(e) => setConnectionId(e.target.value)}>
                {connections.length === 0 && <option value="">No connections</option>}
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                className={cn(selectClasses, "w-56")}
                value={model || effectiveModel}
                onChange={(e) => setModel(e.target.value)}
                disabled={models.length === 0}
              >
                {models.length === 0 && <option value="">No models — refresh in Settings</option>}
                {models.map((m) => (
                  <option key={m.id} value={m.modelId}>
                    {m.displayName ?? m.modelId}
                  </option>
                ))}
              </select>

              <select
                className={cn(selectClasses, "ml-auto w-56")}
                title="Directory this session runs in (runner + working directory)"
                value={session.data?.codeDirectoryId ?? ""}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setNewDirOpen(true);
                    return;
                  }
                  setDirectory.mutate(e.target.value || null);
                }}
              >
                <option value="">No directory</option>
                {(directories.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.displayName} · {d.cwd}
                  </option>
                ))}
                <option value="__new__">+ New directory…</option>
              </select>
            </div>

            <Dialog open={newDirOpen} onOpenChange={setNewDirOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>New working directory</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Display name (e.g. twodb repo)" value={dirName} onChange={(e) => setDirName(e.target.value)} />
                  <Input placeholder="Working directory (e.g. /home/dev/twodb)" value={dirCwd} onChange={(e) => setDirCwd(e.target.value)} />
                  <select className={cn(selectClasses, "w-full")} value={dirRunner} onChange={(e) => setDirRunner(e.target.value)}>
                    <option value="">Select runner…</option>
                    {runners.map((runner) => (
                      <option key={runner.id} value={runner.id} disabled={!runner.online}>
                        {runner.name}
                        {runner.online ? "" : " (offline)"}
                      </option>
                    ))}
                  </select>
                </div>
                <DialogFooter>
                  <Button
                    size="sm"
                    disabled={!dirName.trim() || !dirCwd.trim() || !dirRunner || createDirectory.isPending}
                    onClick={() =>
                      createDirectory.mutate(
                        { displayName: dirName.trim(), cwd: dirCwd.trim(), runnerId: dirRunner },
                        {
                          onSuccess: (row) => {
                            setNewDirOpen(false);
                            setDirName("");
                            setDirCwd("");
                            setDirRunner("");
                            setDirectory.mutate(row.id);
                          },
                        },
                      )
                    }
                  >
                    {createDirectory.isPending ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={14} />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <StatsRow stats={stats} contextWindow={contextWindow} />

            <div className="bg-card focus-within:border-ring rounded-lg border transition-colors">
              <Textarea
                className="min-h-12 resize-none border-0 shadow-none focus-visible:ring-0"
                placeholder={connections.length === 0 ? "Add an LLM connection in Settings → LLM first" : "Ask the agent… (⌘⏎ to send)"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                    e.preventDefault();
                    send(selected?.id, model || effectiveModel);
                  }
                }}
                disabled={connections.length === 0 || running}
              />
              <div className="border-t flex items-center gap-1 border-t px-1.5 py-1">
                <Button variant="ghost" size="icon-sm" title="Attach (coming soon)" disabled>
                  <Paperclip size={14} />
                </Button>
                <Button variant="ghost" size="icon-sm" title="Mention (coming soon)" disabled>
                  <AtSign size={14} />
                </Button>
                <Button
                  size="icon-sm"
                  className="ml-auto"
                  title="Send"
                  onClick={() => send(selected?.id, model || effectiveModel)}
                  disabled={!draft.trim() || running || !selected || !effectiveModel || wsStatus !== "open"}
                >
                  <ArrowUp size={14} />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
