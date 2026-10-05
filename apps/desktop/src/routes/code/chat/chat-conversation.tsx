import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ChevronDown, Loader2, Paperclip, Square, SquarePen } from "lucide-react";
import { useChat } from "./use-chat-panel";
import { CompactionBlock, type CompactionBlockMeta } from "@/components/compaction-block";
import { ClearBlock, type ClearBlockMeta } from "@/components/clear-block";
import { AskUserWizard } from "./ask-user-wizard";
import { SystemPromptBlock } from "./system-prompt-block";
import { CHAT_COMPOSER_COMMANDS } from "@/components/composer/composer-commands";
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
  read_skill: "read-skill",
};

function CanvasChip({ title }: { title: string }) {
  return (
    <div className="bg-muted/60 flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-mono">
      <SquarePen size={12} className="text-lavender-400 shrink-0" aria-hidden="true" />
      <span className="font-medium">update_canvas</span>
      <span className="text-muted-foreground truncate">· {title}</span>
    </div>
  );
}

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

function Message({ role, content, resolveAssetUrl }: { role: string; content: string; resolveAssetUrl?: (uri: string) => string | undefined }) {
  const isUser = role === "user";
  if (isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="bg-card max-w-[85%] rounded-lg px-3 py-2 text-right">
          <span className="text-primary text-[11px] w-full font-semibold tracking-wide uppercase">You</span>

          <MessageMarkdown text={content} resolveAssetUrl={resolveAssetUrl} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Agent</span>
      <MessageMarkdown text={content} resolveAssetUrl={resolveAssetUrl} />
    </div>
  );
}

/** read_asset calls render compactly: read <file> from <backend> at <path> — content stays collapsed. */
function ReadAssetChip({ uri }: { uri: string }) {
  const match = /^twodb:\/\/([^/]+)\/([^/]+)$/.exec(uri);
  const backend = match?.[1] ?? "storage";
  const mediaId = match?.[2] ?? uri;
  return (
    <div className="bg-muted/60 flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-mono">
      <Paperclip size={12} className="text-lavender-400 shrink-0" aria-hidden="true" />
      <span className="font-medium">read-asset</span>
      <span className="text-muted-foreground truncate">
        read {mediaId.length > 8 ? `${mediaId.slice(0, 8)}…` : mediaId} from {backend}
      </span>
    </div>
  );
}

export function ChatConversation() {
  const { sessionId } = useParams<{ sessionId: string }>();
  // twodb:// asset links become session-scoped preview URLs (image thumbnails inline).
  const resolveAssetUrl = (uri: string) => {
    const match = /^twodb:\/\/[^/]+\/([^/]+)$/.exec(uri);
    return match?.[1] ? `/api/code/sessions/${sessionId}/assets/${match[1]}` : undefined;
  };
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
    compacting,
    askUser,
    answerAskUser,
    pendingAssets,
    uploadingAssets,
    uploadAssets,
    removeAsset,
    stats,
    gitStatus,
    skillCommands,
    send,
    stop,
  } = useChat();
  const [viewPaste, setViewPaste] = useState<PasteRef | null>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
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
  // Everything above the newest clear is inert history — dimmed but readable.
  let lastClearIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "clear") lastClearIdx = i;
  }
  const running = streaming !== null;
  let assistantRound = 0;

  const directoryId = session.data?.codeDirectoryId ?? null;
  const filesQuery = useDirectoryFiles(directoryId);
  // Live skills from the session (DB + runner) lead the palette; built-ins follow.
  const composerCommands = useMemo(() => [...skillCommands, ...CHAT_COMPOSER_COMMANDS], [skillCommands]);
  const { editor, submit, pastes } = useComposer({
    files: filesQuery.data?.files ?? [],
    commands: composerCommands,
    disabled: running || compacting || connections.length === 0,
    placeholder: connections.length === 0 ? "Add an LLM connection in Settings → LLM first" : "Ask the agent… — @ files, / commands",
    onDraft: setDraft,
    onSend: (content) => send(selected?.id, model || effectiveModel, thinkingLevel, content),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <SystemPromptBlock />
          {messages.map((m, idx) => {
            const dimmed = lastClearIdx >= 0 && idx < lastClearIdx;
            if (m.role === "tool") {
              // Merged into the assistant's tool block — only orphaned tool
              // messages (no matching tool call) render standalone.
              if (!orphanToolIds.has(m.id)) return null;
              const meta = m.meta as { name?: string; startedAt?: number; completedAt?: number; status?: string } | null;
              return (
                <div key={m.id} className={dimmed ? "opacity-60" : undefined}>
                  <ToolBlock
                    name={meta?.name ?? "tool"}
                    output={m.content}
                    startedAt={meta?.startedAt}
                    completedAt={meta?.completedAt}
                    failed={meta?.status === "failed"}
                    defaultOpen={toolOutputsOpen}
                  />
                </div>
              );
            }
            if (m.role === "compaction") {
              // Persisted compaction boundary — summary of everything above.
              const meta = m.meta as unknown as CompactionBlockMeta | null;
              if (!meta?.summary) return null;
              return (
                <div key={m.id} className={dimmed ? "opacity-60" : undefined}>
                  <CompactionBlock meta={meta} />
                </div>
              );
            }
            if (m.role === "clear") {
              // Persisted clear boundary — hard context cutoff, nothing replayed.
              return <ClearBlock key={m.id} meta={m.meta as ClearBlockMeta | null} />;
            }
            if (m.role === "ask_user") {
              // Durable question marker — the wizard (live or restored) is the UI.
              return null;
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
              <div key={m.id} className={cn("flex flex-col gap-4", dimmed && "opacity-60")}>
                {meta?.thinking?.map((t, i) => (
                  <ThinkingBlock key={i} text={t.text} live={false} durationMs={t.durationMs} visible={showThinking} />
                ))}
                {m.content && <Message role={m.role} content={m.content} resolveAssetUrl={resolveAssetUrl} />}
                {meta?.stopped && <span className="text-muted-foreground/70 text-[11px] italic">stopped</span>}
                {meta?.toolCalls?.map((tc) => {
                  if (tc.name === "update_canvas") {
                    return <CanvasChip key={tc.id} title={String(tc.arguments.title ?? "")} />;
                  }
                  if (tc.name === "read_asset") {
                    return <ReadAssetChip key={tc.id} uri={String(tc.arguments.uri ?? "")} />;
                  }
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
          {optimistic && <Message role="user" content={optimistic.content} resolveAssetUrl={resolveAssetUrl} />}
          {compacting && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" /> compacting context…
            </div>
          )}
          {running && (
            <div className="flex flex-col gap-2">
              <div className="text-muted-foreground/70 flex items-center gap-1.5 border-t border-dashed pt-3 text-[10px] font-semibold tracking-wide uppercase">
                <Loader2 size={10} className="animate-spin" aria-hidden="true" />
                Live{round !== null ? ` · round ${round}` : ""}
              </div>
              {liveTools.map((t) =>
                t.name === "read_asset" ? (
                  <ReadAssetChip key={t.id} uri={String(t.args?.uri ?? "")} />
                ) : (
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
                ),
              )}
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
                <Message role="assistant" content={streaming} resolveAssetUrl={resolveAssetUrl} />
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
        {askUser ? (
          <AskUserWizard questions={askUser.questions} onSubmit={answerAskUser} onStop={stop} />
        ) : (
          <div className="bg-card focus-within:border-ring rounded-lg border transition-colors">
            {(pendingAssets.length > 0 || uploadingAssets) && (
              <div className="flex flex-wrap gap-1.5 px-2 pt-2">
                {pendingAssets.map((asset) => (
                  <span key={asset.uri} className="bg-muted/60 flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs">
                    {asset.localPreview ? (
                      <img src={asset.localPreview} alt={asset.filename} className="size-5 rounded-sm object-cover" />
                    ) : (
                      <Paperclip size={11} aria-hidden="true" />
                    )}
                    <span className="max-w-44 truncate">{asset.filename}</span>
                    <button className="text-muted-foreground/60 hover:text-destructive" title="Remove attachment" onClick={() => removeAsset(asset.uri)}>
                      ×
                    </button>
                  </span>
                ))}
                {uploadingAssets && (
                  <span className="text-muted-foreground flex items-center gap-1.5 px-1 py-1 text-xs">
                    <Loader2 size={11} className="animate-spin" aria-hidden="true" /> uploading…
                  </span>
                )}
              </div>
            )}
            <input
              ref={assetInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadAssets(e.target.files);
                e.target.value = "";
              }}
            />
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
              <Button
                variant="ghost"
                size="icon-sm"
                title="Attach files — stored via the Agents Assets destination"
                disabled={uploadingAssets}
                onClick={() => assetInputRef.current?.click()}
              >
                {uploadingAssets ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
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
        )}

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
