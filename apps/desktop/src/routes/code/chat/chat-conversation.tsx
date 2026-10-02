import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ChevronDown, Loader2, Paperclip, Square } from "lucide-react";
import { useChat } from "./use-chat-panel";
import { MessageMarkdown } from "@/components/message-markdown";
import { ThinkingBlock, ToolDuration } from "@/components/thinking-block";
import { useModelConfig } from "@/components/model-picker/use-model-config";
import { ChatFooter } from "./footer/chat-footer";
import { ModelDialog } from "@/components/model-picker/model-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditorContent } from "@tiptap/react";
import { useComposer } from "@/components/composer/use-composer";
import type { PasteRef } from "@/components/composer/paste-chip";
import { useDirectoryFiles } from "./composer/use-directory-files";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const cmdMap: Record<string, string> = {
  run_command: "$",
};

function ToolBlock({
  name,
  args,
  output,
  running,
  startedAt,
  completedAt,
  failed,
  defaultOpen,
}: {
  name: string;
  args?: Record<string, unknown>;
  output?: string;
  running?: boolean;
  startedAt?: number;
  completedAt?: number;
  failed?: boolean;
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen ?? false);
  // The global Ctrl+O flip overrides individual blocks.
  useEffect(() => setExpanded(defaultOpen ?? false), [defaultOpen]);
  const hasOutput = output !== undefined && output !== "";
  const preview =
    typeof args?.command === "string"
      ? args.command
      : typeof args?.path === "string"
        ? args.path
        : typeof args?.pattern === "string"
          ? args.pattern
          : typeof args?.url === "string"
            ? args.url
            : typeof args?.query === "string"
              ? args.query
              : undefined;

  const cmdName = cmdMap[name] ?? name;

  return (
    <div className={cn("rounded-lg border text-xs", failed ? "bg-destructive/10 border-destructive/40" : "bg-muted/60")}>
      <button className="hover:bg-accent/50 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-mono" onClick={() => setExpanded((v) => !v)}>
        {running ? <Loader2 size={12} className="text-primary animate-spin" aria-hidden="true" /> : null}
        <span className="font-medium">{cmdName}</span>
        {preview && <span className="text-muted-foreground truncate">{preview}</span>}
        <ToolDuration startedAt={startedAt} completedAt={completedAt} />
        {hasOutput && (
          <ChevronDown
            size={12}
            className={cn("text-muted-foreground/70 ml-auto shrink-0 transition-transform", !expanded && "-rotate-90")}
            aria-hidden="true"
          />
        )}
      </button>
      {expanded && hasOutput && <pre className="text-muted-foreground max-h-80 overflow-y-auto border-t px-3 py-2 whitespace-pre-wrap">{output}</pre>}
    </div>
  );
}

function Message({ role, content }: { role: string; content: string }) {
  const isUser = role === "user";
  if (isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="bg-card max-w-[85%] rounded-lg px-3 py-2 text-right">
          <span className="text-primary text-[11px] w-full font-semibold tracking-wide uppercase">You</span>

          <MessageMarkdown text={content} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Agent</span>
      <MessageMarkdown text={content} />
    </div>
  );
}

export function ChatConversation() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const {
    session,
    draft,
    setDraft,
    streaming,
    liveTools,
    error,
    wsStatus,
    statusText,
    round,
    thinking,
    thinkingLive,
    thinkingStartedAt,
    thinkingDurationMs,
    optimistic,
    stats,
    gitStatus,
    send,
    stop,
  } = useChat();
  const [viewPaste, setViewPaste] = useState<PasteRef | null>(null);
  const [showThinking, setShowThinking] = useState(() => localStorage.getItem("twodb.showThinking") !== "false");
  const queryClient = useQueryClient();
  const [toolOutputsOpen, setToolOutputsOpen] = useState(false);

  useEffect(() => {
    const prefs = session.data?.runtimeState as { toolOutputsExpanded?: boolean } | null | undefined;
    setToolOutputsOpen(prefs?.toolOutputsExpanded ?? false);
  }, [session.data?.id]);

  const toggleToolOutputs = () => {
    const next = !toolOutputsOpen;
    setToolOutputsOpen(next);
    void api(`/api/code/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify({ runtimeState: { ...(session.data?.runtimeState ?? {}), toolOutputsExpanded: next } }),
    })
      .then(() => queryClient.invalidateQueries({ queryKey: ["code", "session", sessionId] }))
      .catch(() => {});
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "t") {
        event.preventDefault();
        setShowThinking((v) => {
          localStorage.setItem("twodb.showThinking", v ? "false" : "true");
          return !v;
        });
      } else if (key === "o") {
        event.preventDefault();
        toggleToolOutputs();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const config = useModelConfig(sessionId ?? null, session);
  const { connections, selected, effectiveModel, model, thinkingLevel, contextWindow, setConfigOpen } = config;

  // Committed tool calls render as ONE block: the assistant message's
  // meta.toolCalls carry the request, the following role="tool" messages carry
  // the output. Two O(n) passes, memoized on the query data identity.
  const committedMessages = session.data?.messages;
  const { toolOutputs, toolTimings, orphanToolIds } = useMemo(() => {
    const outputs = new Map<string, string>();
    const timings = new Map<string, { startedAt?: number; completedAt?: number; status?: string }>();
    const callIds = new Set<string>();
    for (const m of committedMessages ?? []) {
      if (m.role === "tool") {
        const meta = m.meta as { toolCallId?: string; startedAt?: number; completedAt?: number; status?: string } | null;
        if (meta?.toolCallId) {
          outputs.set(meta.toolCallId, m.content);
          timings.set(meta.toolCallId, { startedAt: meta.startedAt, completedAt: meta.completedAt, status: meta.status });
        }
      } else {
        const meta = m.meta as { toolCalls?: { id: string }[] } | null;
        for (const tc of meta?.toolCalls ?? []) callIds.add(tc.id);
      }
    }
    const orphans = new Set<string>();
    for (const m of committedMessages ?? []) {
      if (m.role !== "tool") continue;
      const meta = m.meta as { toolCallId?: string } | null;
      if (!meta?.toolCallId || !callIds.has(meta.toolCallId)) orphans.add(m.id);
    }
    return { toolOutputs: outputs, toolTimings: timings, orphanToolIds: orphans };
  }, [committedMessages]);

  const messages = session.data?.messages ?? [];
  const running = streaming !== null;
  let assistantRound = 0;

  const directoryId = session.data?.codeDirectoryId ?? null;
  const filesQuery = useDirectoryFiles(directoryId);
  const { editor, submit, pastes } = useComposer({
    files: filesQuery.data?.files ?? [],
    disabled: running || connections.length === 0,
    placeholder: connections.length === 0 ? "Add an LLM connection in Settings → LLM first" : "Ask the agent… — @ files, / commands",
    onDraft: setDraft,
    onSend: (content) => send(selected?.id, model || effectiveModel, thinkingLevel, content),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {messages.map((m) => {
            if (m.role === "tool") {
              // Merged into the assistant's tool block — only orphaned tool
              // messages (no matching tool call) render standalone.
              if (!orphanToolIds.has(m.id)) return null;
              const meta = m.meta as { name?: string; startedAt?: number; completedAt?: number; status?: string } | null;
              return (
                <ToolBlock
                  key={m.id}
                  name={meta?.name ?? "tool"}
                  output={m.content}
                  startedAt={meta?.startedAt}
                  completedAt={meta?.completedAt}
                  failed={meta?.status === "failed"}
                  defaultOpen={toolOutputsOpen}
                />
              );
            }
            const meta = m.meta as {
              toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
              thinking?: { text: string; durationMs?: number }[];
              thinkingLevel?: string;
              stopped?: boolean;
            } | null;
            const isAssistant = m.role === "assistant";
            if (isAssistant) assistantRound += 1;
            return (
              <div key={m.id} className="flex flex-col gap-4">
                {meta?.thinking?.map((t, i) => (
                  <ThinkingBlock key={i} text={t.text} live={false} durationMs={t.durationMs} visible={showThinking} />
                ))}
                {m.content && <Message role={m.role} content={m.content} />}
                {meta?.stopped && <span className="text-muted-foreground/70 text-[11px] italic">stopped</span>}
                {meta?.toolCalls?.map((tc) => {
                  const timing = toolTimings.get(tc.id);
                  return (
                    <ToolBlock
                      key={tc.id}
                      name={tc.name}
                      args={tc.arguments}
                      output={toolOutputs.get(tc.id)}
                      startedAt={timing?.startedAt}
                      completedAt={timing?.completedAt}
                      failed={timing?.status === "failed"}
                      defaultOpen={toolOutputsOpen}
                    />
                  );
                })}
                {isAssistant && (
                  <div className="text-muted-foreground/60 flex items-center gap-3 py-1 font-mono text-[10px]">
                    <span className="bg-border h-px flex-1" aria-hidden="true" />
                    <span>round {assistantRound} complete</span>
                    <span className="bg-border h-px flex-1" aria-hidden="true" />
                  </div>
                )}
              </div>
            );
          })}
          {optimistic && <Message role="user" content={optimistic.content} />}
          {running && (
            <div className="flex flex-col gap-2">
              <div className="text-muted-foreground/70 flex items-center gap-1.5 border-t border-dashed pt-3 text-[10px] font-semibold tracking-wide uppercase">
                <Loader2 size={10} className="animate-spin" aria-hidden="true" />
                Live{round !== null ? ` · round ${round}` : ""}
              </div>
              {liveTools.map((t) => (
                <ToolBlock
                  key={t.id}
                  name={t.name}
                  args={t.args}
                  output={t.output}
                  running={!t.done}
                  startedAt={t.startedAt}
                  completedAt={t.completedAt}
                  failed={t.status === "failed"}
                  defaultOpen={toolOutputsOpen}
                />
              ))}
              {thinking !== null && (
                <ThinkingBlock
                  text={thinking}
                  live={thinkingLive}
                  startedAt={thinkingStartedAt ?? undefined}
                  durationMs={thinkingDurationMs ?? undefined}
                  visible={showThinking}
                />
              )}
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

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
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
          <div className="flex items-center gap-1 border-t px-1.5 py-1">
            <Button variant="ghost" size="icon-sm" title="Attach (coming soon)" disabled>
              <Paperclip size={14} />
            </Button>
            {running ? (
              <Button size="icon-sm" variant="destructive" className="ml-auto" title="Stop" onClick={stop}>
                <Square size={12} />
              </Button>
            ) : (
              <Button
                size="icon-sm"
                className="ml-auto"
                title="Send"
                onClick={submit}
                disabled={!draft.trim() || !selected || !effectiveModel || wsStatus !== "open"}
              >
                <ArrowUp size={14} />
              </Button>
            )}
          </div>
        </div>

        <ChatFooter
          stats={stats}
          contextWindow={contextWindow}
          model={model}
          effectiveModel={effectiveModel}
          thinkingLevel={thinkingLevel}
          onOpenConfig={() => setConfigOpen(true)}
          gitStatus={gitStatus}
        />

        <ModelDialog config={config} />

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
      </div>
    </div>
  );
}
