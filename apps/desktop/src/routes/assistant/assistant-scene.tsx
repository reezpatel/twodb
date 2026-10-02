import { useEffect, useMemo, useState } from "react";
import { Copy, FileText, Loader2, Plus, Search, Send, SquarePen } from "lucide-react";
import { useAssistantScene, type AssistantThread } from "./use-assistant-scene";
import { useAssistantChat } from "./use-assistant-chat";
import { useCanvasPreview } from "./use-canvas-preview";
import { MessageMarkdown } from "@/components/message-markdown";
import { EditorContent } from "@tiptap/react";
import { useComposer } from "@/components/composer/use-composer";
import type { PasteRef } from "@/components/composer/paste-chip";
import { StatsRow } from "@/components/model-picker/stats-row";
import { ModelDialog } from "@/components/model-picker/model-dialog";
import { useModelConfig } from "@/components/model-picker/use-model-config";
import { ThinkingBlock } from "@/components/thinking-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

function Message({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  if (isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="bg-card max-w-[85%] rounded-lg px-3 py-2 text-right">
          <span className="text-primary text-[11px] w-full font-semibold tracking-wide uppercase">You</span>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{content}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Assistant</span>
      <MessageMarkdown variant="plain" text={content} />
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

export function AssistantScene() {
  const { threads, thread, selectedId, setSelectedId, create, remove } = useAssistantScene();
  const chat = useAssistantChat(selectedId, thread.data ? { artifacts: thread.data.artifacts, usage: thread.data.usage } : undefined);

  const [viewPaste, setViewPaste] = useState<PasteRef | null>(null);
  const config = useModelConfig(selectedId, thread, {
    endpoint: "/api/assistant/threads",
    queryKeyBase: ["assistant", "thread"],
  });
  const { connections, selected, effectiveModel, model, thinkingLevel, contextWindow, setConfigOpen } = config;
  const running = chat.streaming !== null;
  const [showThinking, setShowThinking] = useState(() => localStorage.getItem("twodb.showThinking") !== "false");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "t") {
        event.preventDefault();
        setShowThinking((v) => {
          localStorage.setItem("twodb.showThinking", v ? "false" : "true");
          return !v;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const { editor, submit, pastes } = useComposer({
    files: null,
    disabled: running || connections.length === 0,
    placeholder: connections.length === 0 ? "Add an LLM connection in Settings → LLM first" : "Ask anything… — / for commands",
    onDraft: chat.setDraft,
    onSend: (content) => chat.send(selected?.id, model || effectiveModel, thinkingLevel ?? undefined, content),
  });

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
  const artifact = chat.activeArtifact;
  const preview = useCanvasPreview(artifact && (artifact.type === "markdown" || artifact.type === "text") ? artifact : null);

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
                  const meta = m.meta as {
                    toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
                    thinking?: { text: string; durationMs?: number }[];
                  } | null;
                  return (
                    <div key={m.id} className="flex flex-col gap-2">
                      {meta?.thinking?.map((t, i) => (
                        <ThinkingBlock key={i} text={t.text} live={false} durationMs={t.durationMs} visible={showThinking} />
                      ))}
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
                    {chat.thinking !== null && (
                      <ThinkingBlock
                        text={chat.thinking}
                        live={chat.thinkingLive}
                        startedAt={chat.thinkingStartedAt ?? undefined}
                        durationMs={chat.thinkingDurationMs ?? undefined}
                        visible={showThinking}
                      />
                    )}
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
              <StatsRow stats={chat.stats} contextWindow={contextWindow}>
                <button
                  type="button"
                  className="hover:text-foreground font-medium transition-colors"
                  title="Connection & model"
                  onClick={() => setConfigOpen(true)}
                >
                  {model || effectiveModel || "no model"}
                </button>
                <Badge variant={chat.wsStatus === "open" ? "success" : "secondary"} className="ml-auto" title={`Chat socket: ${chat.wsStatus}`}>
                  {chat.wsStatus === "open" ? "live" : chat.wsStatus}
                </Badge>
              </StatsRow>

              <div className="bg-card focus-within:border-ring rounded-lg border transition-colors">
                <div
                  onClick={(e) => {
                    const chip = (e.target as HTMLElement).closest("[data-paste-chip]");
                    if (!chip) return;
                    const paste = pastes.current.get(chip.getAttribute("data-paste-id") ?? "");
                    if (paste) setViewPaste(paste);
                  }}
                >
                  <EditorContent editor={editor} className="min-h-12" />
                </div>
                <div className="border-t flex items-center gap-1 border-t px-1.5 py-1">
                  <Button variant="ghost" size="icon-sm" title="Search the web (coming soon)" disabled>
                    <Search size={14} />
                  </Button>
                  <Button
                    size="icon-sm"
                    className="ml-auto"
                    title="Send"
                    onClick={submit}
                    disabled={!chat.draft.trim() || running || !selected || !effectiveModel || chat.wsStatus !== "open"}
                  >
                    <Send size={14} />
                  </Button>
                </div>
              </div>

              <Dialog open={!!viewPaste} onOpenChange={(o) => !o && setViewPaste(null)}>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      Paste #{viewPaste?.id} — {viewPaste?.lines} lines
                    </DialogTitle>
                  </DialogHeader>
                  <pre className="bg-muted max-h-[60vh] overflow-auto rounded-lg p-3 font-mono text-xs whitespace-pre-wrap">{viewPaste?.content}</pre>
                </DialogContent>
              </Dialog>

              <ModelDialog config={config} />
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
                preview && <EditorContent editor={preview} className="note-editor-scroll min-h-0 h-full" />
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
