import { useMemo, useState } from "react";
import { Copy, FileText, Loader2, Plus, Search, Send, SquarePen } from "lucide-react";
import { useAssistantScene, type AssistantThread } from "./use-assistant-scene";
import { useAssistantChat } from "./use-assistant-chat";
import { useConnectionPicker } from "../code/use-connection-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const selectClasses =
  "border-input bg-background focus:border-ring focus:ring-ring/50 h-8 rounded-md border px-2 text-sm shadow-xs focus:outline-none disabled:opacity-50 max-w-56";

function groupLabel(updatedAt: string) {
  const date = new Date(updatedAt);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return "Earlier";
}

function relativeTime(updatedAt: string) {
  const diff = Date.now() - new Date(updatedAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function Message({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("text-[11px] font-semibold tracking-wide uppercase", isUser ? "text-primary" : "text-muted-foreground")}>
        {isUser ? "You" : "Assistant"}
      </span>
      <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
    </div>
  );
}

function CanvasChip({ title }: { title: string }) {
  return (
    <div className="bg-muted/60 flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-mono">
      <SquarePen size={12} className="text-lavender-400" aria-hidden="true" />
      <span className="font-medium">update_canvas</span>
      <span className="text-muted-foreground truncate">· {title}</span>
    </div>
  );
}

function StatsRow({ stats }: { stats: ReturnType<typeof useAssistantChat>["stats"] }) {
  const cachePct = stats.inputTokens > 0 ? Math.round((stats.cachedTokens / stats.inputTokens) * 100) : null;
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs">
      <span title="Input tokens (incl. cached)">↑ {fmtTokens(stats.inputTokens)}</span>
      <span title="Output tokens">↓ {fmtTokens(stats.outputTokens)}</span>
      <span title="Cache hit">⚡ {cachePct !== null ? `${cachePct}%` : "—"}</span>
      <span title="Generation speed">{stats.tokPerSec !== null ? `${stats.tokPerSec} tok/s` : "—"}</span>
      <span className="flex items-center gap-2" title="Context consumed">
        <Progress value={Math.min(100, stats.contextTokens > 0 ? 100 : 0)} className="h-1.5 w-24" />
        <span>{fmtTokens(stats.contextTokens)}</span>
      </span>
    </div>
  );
}

export function AssistantScene() {
  const { threads, thread, selectedId, setSelectedId, create, remove } = useAssistantScene();
  const chat = useAssistantChat(selectedId, thread.data ? { artifacts: thread.data.artifacts, usage: thread.data.usage } : undefined);

  const [connectionId, setConnectionId] = useState("");
  const [model, setModel] = useState("");
  const { connections, selected, models, effectiveModel } = useConnectionPicker(connectionId, model);

  const groups = useMemo(() => {
    const map = new Map<string, AssistantThread[]>();
    for (const t of threads.data ?? []) {
      const label = groupLabel(t.updatedAt);
      const bucket = map.get(label) ?? [];
      bucket.push(t);
      map.set(label, bucket);
    }
    return [...map.entries()];
  }, [threads.data]);

  const messages = thread.data?.messages ?? [];
  const running = chat.streaming !== null;
  const artifact = chat.activeArtifact;

  return (
    <div className="flex h-full">
      {/* 1 — threads */}
      <aside className="bg-card border-r flex h-full w-60 shrink-0 flex-col border-r">
        <div className="border-b flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Threads</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" title="New thread" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {groups.map(([label, items]) => (
            <div key={label}>
              <div className="text-muted-foreground/70 px-3 pb-1 pt-3 text-[11px] font-semibold tracking-wide uppercase">{label}</div>
              {items.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "group mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                    selectedId === t.id && "bg-accent font-medium",
                  )}
                  onClick={() => setSelectedId(t.id)}
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-full", selectedId === t.id && running ? "animate-pulse bg-primary" : "bg-muted-foreground/30")}
                  />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="text-muted-foreground/70 text-xs">{relativeTime(t.updatedAt)}</span>
                  <button
                    className="text-muted-foreground/50 hover:text-destructive hidden shrink-0 text-sm leading-none group-hover:block"
                    title="Delete thread"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${t.title}"?`)) remove.mutate(t.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ))}
          {(threads.data ?? []).length === 0 && !threads.isPending && <p className="text-muted-foreground p-3 text-sm">No threads yet — hit + to start one.</p>}
        </div>
      </aside>

      {/* 2 — chat */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {!selectedId ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <SquarePen size={28} className="text-muted-foreground/50" aria-hidden="true" />
              <p className="text-muted-foreground text-sm font-medium">Assistant</p>
              <p className="text-muted-foreground/70 max-w-xs text-center text-xs">Chat with any of your models. Substantial documents open on the canvas.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mx-auto flex max-w-3xl flex-col gap-4">
                {messages.map((m) => {
                  if (m.role === "tool") {
                    return <CanvasChip key={m.id} title={m.content.replace("canvas updated: ", "")} />;
                  }
                  const meta = m.meta as { toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[] } | null;
                  return (
                    <div key={m.id} className="flex flex-col gap-2">
                      {m.content && <Message role={m.role} content={m.content} />}
                      {meta?.toolCalls
                        ?.filter((tc) => tc.name === "update_canvas")
                        .map((tc) => (
                          <CanvasChip key={tc.id} title={String(tc.arguments.title ?? "")} />
                        ))}
                    </div>
                  );
                })}
                {chat.optimistic && <Message role="user" content={chat.optimistic.content} />}
                {running && (
                  <div className="flex flex-col gap-2">
                    {chat.streaming ? (
                      <Message role="assistant" content={chat.streaming} />
                    ) : (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" /> thinking
                      </div>
                    )}
                  </div>
                )}
                {chat.error && (
                  <p className="text-destructive text-sm" role="alert">
                    {chat.error}
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
                <Badge variant={chat.wsStatus === "open" ? "success" : "secondary"} className="ml-auto" title={`Chat socket: ${chat.wsStatus}`}>
                  {chat.wsStatus === "open" ? "live" : chat.wsStatus}
                </Badge>
              </div>

              <StatsRow stats={chat.stats} />

              <div className="bg-card focus-within:border-ring rounded-lg border transition-colors">
                <Textarea
                  className="min-h-12 resize-none border-0 shadow-none focus-visible:ring-0"
                  placeholder={connections.length === 0 ? "Add an LLM connection in Settings → LLM first" : "Ask anything… (⌘⏎ to send)"}
                  value={chat.draft}
                  onChange={(e) => chat.setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                      e.preventDefault();
                      chat.send(selected?.id, model || effectiveModel);
                    }
                  }}
                  disabled={connections.length === 0 || running}
                />
                <div className="border-t flex items-center gap-1 border-t px-1.5 py-1">
                  <Button variant="ghost" size="icon-sm" title="Search the web (coming soon)" disabled>
                    <Search size={14} />
                  </Button>
                  <Button
                    size="icon-sm"
                    className="ml-auto"
                    title="Send"
                    onClick={() => chat.send(selected?.id, model || effectiveModel)}
                    disabled={!chat.draft.trim() || running || !selected || !effectiveModel || chat.wsStatus !== "open"}
                  >
                    <Send size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3 — canvas */}
      <aside className="bg-card border-l hidden h-full w-[26rem] shrink-0 flex-col border-l xl:flex">
        <div className="border-b flex items-center gap-2 border-b px-3 py-2">
          <FileText size={14} className="text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-semibold">Canvas</span>
          {chat.artifacts.length > 1 && (
            <select
              className={cn(selectClasses, "ml-auto h-7 w-40 text-xs")}
              value={artifact?.id ?? ""}
              onChange={(e) => chat.setActiveArtifactId(e.target.value)}
            >
              {chat.artifacts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          )}
          {artifact && (
            <Button
              variant="ghost"
              size="icon-sm"
              className={chat.artifacts.length > 1 ? "" : "ml-auto"}
              title="Copy content"
              onClick={() => void navigator.clipboard.writeText(artifact.content)}
            >
              <Copy size={13} />
            </Button>
          )}
        </div>

        {artifact ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 px-4 pt-3">
              <span className="text-sm font-medium">{artifact.title}</span>
              <Badge variant="secondary" className="text-[10px]">
                {artifact.type}
              </Badge>
              {running && <span className="loading loading-dots loading-xs" title="updating" />}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {artifact.type === "markdown" || artifact.type === "text" ? (
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{artifact.content}</div>
              ) : (
                <pre className="text-muted-foreground font-mono text-xs whitespace-pre-wrap">{artifact.content}</pre>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
            <SquarePen size={24} className="text-muted-foreground/40" aria-hidden="true" />
            <p className="text-muted-foreground text-sm font-medium">Canvas</p>
            <p className="text-muted-foreground/70 text-center text-xs">Documents the assistant writes appear here and update live while it works.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
