import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ChevronDown, Loader2, Paperclip, Square, SquarePen } from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useChat, type ToolEvent } from "./use-chat-panel";
import type { CodeMessage } from "../sidenav/use-session-list";
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

interface ChatMessageListProps {
  messages: CodeMessage[];
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
  sessionId: string;
  streaming: string | null;
  running: boolean;
  thinking: string | null;
  thinkingLive: boolean;
  thinkingStartedAt: number | null;
  thinkingDurationMs: number | null;
  liveTools: ToolEvent[];
  statusText: string | null;
  optimistic: CodeMessage | null;
  compacting: boolean;
  error: string | null;
  showThinking: boolean;
  toolOutputsOpen: boolean;
  round: number | null;
  resolveAssetUrl: (uri: string) => string | undefined;
  toolOutputs: Map<string, string>;
  toolTimings: Map<string, { startedAt?: number; completedAt?: number; status?: string }>;
  orphanToolIds: Set<string>;
}

/**
 * The transcript: virtualized (only ~10 rows above/below the viewport mount),
 * stick-to-bottom while the user is at the end (streaming keeps scrolling),
 * static once they scroll away, with a jump-to-latest affordance.
 */
function ChatMessageList(props: ChatMessageListProps) {
  const { messages, hasOlder, loadingOlder, loadOlder, streaming, running, optimistic, compacting, error } = props;
  const {
    thinking, thinkingLive, thinkingStartedAt, thinkingDurationMs, liveTools, statusText,
    showThinking, toolOutputsOpen, round, resolveAssetUrl, toolOutputs, toolTimings, orphanToolIds,
  } = props;
  const virtuoso = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const rows = useMemo(() => renderableRows(messages, orphanToolIds), [messages, orphanToolIds]);

  // New content while pinned → keep scrolling; while reading above → stay put.
  useEffect(() => {
    if (atBottom) virtuoso.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "auto" });
  }, [atBottom, rows.length, streaming, liveTools.length, thinking, optimistic, compacting]);

  // Backfill prepends rows; Virtuoso preserves the viewport only when
  // firstItemIndex drops by exactly the prepended count. Track it by watching
  // the first row's identity — appends and session resets don't shift it.
  const [firstItemIndex, setFirstItemIndex] = useState(1_000_000);
  const prevFirstIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (rows.length === 0) {
      prevFirstIdRef.current = null;
      return;
    }
    const prevFirst = prevFirstIdRef.current;
    const nowFirst = rows[0].message.id;
    if (prevFirst !== null && nowFirst !== prevFirst) {
      const idx = rows.findIndex((r) => r.message.id === prevFirst);
      if (idx > 0) setFirstItemIndex((i) => i - idx);
    }
    prevFirstIdRef.current = nowFirst;
  }, [rows]);

  const startReached = () => {
    if (hasOlder && !loadingOlder) loadOlder();
  };

  // Deadlock guard: when the renderable rows don't fill the viewport there is
  // no scroll to reach the start with — keep pulling pages until they do.
  const scrollerHeightRef = useRef(0);
  const totalListHeightRef = useRef(0);
  useEffect(() => {
    if (!hasOlder || loadingOlder) return;
    if (totalListHeightRef.current === 0) return; // not measured yet
    if (totalListHeightRef.current < scrollerHeightRef.current + 400) loadOlder();
  });

  return (
    <div className="relative min-h-0 flex-1">
      <Virtuoso
        ref={virtuoso}
        className="h-full"
        followOutput={(isAtBottom) => (isAtBottom ? "smooth" : false)}
        initialTopMostItemIndex={Number.MAX_SAFE_INTEGER}
        firstItemIndex={firstItemIndex}
        startReached={startReached}
        atBottomStateChange={setAtBottom}
        rangeChanged={(range) => {
          setShowJump(range.endIndex < rows.length - 4 && !atBottom);
          // Near-top triggers backfill even when the list is too short to
          // ever produce a startReached scroll event.
          if (range.startIndex <= 2 && hasOlder && !loadingOlder) loadOlder();
        }}
        increaseViewportBy={{ top: 600, bottom: 600 }}
        totalListHeightChanged={(h) => (totalListHeightRef.current = h)}
        scrollerRef={(el) => {
          scrollerHeightRef.current = el instanceof HTMLElement ? el.clientHeight : 0;
        }}
        components={{
          Header: () => (
            <div className="text-muted-foreground py-3 text-center text-xs">
              {loadingOlder ? "loading earlier messages…" : hasOlder ? "scroll up for earlier messages" : null}
            </div>
          ),
          Footer: () => (
            <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 pb-6">
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
            </div>
          ),
          EmptyPlaceholder: () => <SystemPromptBlock />,
        }}
        data={rows}
        itemContent={(_, row) => (
          <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-2">
            {renderRow(row)}
          </div>
        )}
      />
      {showJump && (
        <button
          className="bg-card text-muted-foreground hover:text-foreground absolute right-4 bottom-4 z-10 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-sm"
          onClick={() => virtuoso.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "smooth" })}
        >
          <ChevronDown size={13} /> latest
        </button>
      )}
      {error && (
        <p className="text-destructive absolute top-2 right-4 z-10 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );

  function renderableRows(list: CodeMessage[], orphans: Set<string>) {
    let assistantRound = 0;
    const out: RenderRow[] = [];
    let lastClearIdx = -1;
    for (let i = 0; i < list.length; i++) if (list[i].role === "clear") lastClearIdx = i;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.role === "tool" && !orphans.has(m.id)) continue;
      if (m.role === "ask_user") continue;
      if (m.role === "compaction" && !(m.meta as CompactionBlockMeta | null)?.summary) continue;
      if (m.role === "assistant") assistantRound += 1;
      out.push({ message: m, dimmed: lastClearIdx >= 0 && i < lastClearIdx, round: m.role === "assistant" ? assistantRound : null });
    }
    return out;
  }

  function renderRow(row: RenderRow) {
    const m = row.message;
    if (m.role === "clear") return <ClearBlock meta={m.meta as ClearBlockMeta | null} />;
    if (m.role === "compaction") return <CompactionBlock meta={m.meta as unknown as CompactionBlockMeta} />;
    if (m.role === "tool") {
      const meta = m.meta as { name?: string; startedAt?: number; completedAt?: number; status?: string } | null;
      return (
        <div className={row.dimmed ? "opacity-60" : undefined}>
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
    const meta = m.meta as {
      toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
      thinking?: { text: string; durationMs?: number }[];
      stopped?: boolean;
    } | null;
    return (
      <div className={cn("flex flex-col gap-4", row.dimmed && "opacity-60")}>
        {meta?.thinking?.map((t, i) => (
          <ThinkingBlock key={i} text={t.text} live={false} durationMs={t.durationMs} visible={showThinking} />
        ))}
        {m.content && <Message role={m.role} content={m.content} resolveAssetUrl={resolveAssetUrl} />}
        {meta?.stopped && <span className="text-muted-foreground/70 text-[11px] italic">stopped</span>}
        {meta?.toolCalls?.map((tc) => {
          if (tc.name === "update_canvas") return <CanvasChip key={tc.id} title={String(tc.arguments.title ?? "")} />;
          if (tc.name === "read_asset") return <ReadAssetChip key={tc.id} uri={String(tc.arguments.uri ?? "")} />;
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
        {row.round !== null && (
          <div className="text-muted-foreground/60 flex items-center gap-3 py-1 font-mono text-[10px]">
            <span className="bg-border h-px flex-1" aria-hidden="true" />
            <span>round {row.round} complete</span>
            <span className="bg-border h-px flex-1" aria-hidden="true" />
          </div>
        )}
      </div>
    );
  }
}

interface RenderRow {
  message: CodeMessage;
  dimmed: boolean;
  round: number | null;
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
    visibleMessages: messages,
    hasOlder,
    loadingOlder,
    loadOlder,
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
  // the output. Two O(n) passes, memoized on the accumulated history identity.
  const { toolOutputs, toolTimings, orphanToolIds } = useMemo(() => {
    const outputs = new Map<string, string>();
    const timings = new Map<string, { startedAt?: number; completedAt?: number; status?: string }>();
    const callIds = new Set<string>();
    for (const m of messages) {
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
    for (const m of messages) {
      if (m.role !== "tool") continue;
      const meta = m.meta as { toolCallId?: string } | null;
      if (!meta?.toolCallId || !callIds.has(meta.toolCallId)) orphans.add(m.id);
    }
    return { toolOutputs: outputs, toolTimings: timings, orphanToolIds: orphans };
  }, [messages]);

  const running = streaming !== null;

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
      <ChatMessageList
        messages={messages}
        hasOlder={hasOlder}
        loadingOlder={loadingOlder}
        loadOlder={loadOlder}
        sessionId={sessionId ?? ""}
        streaming={streaming}
        running={running}
        thinking={thinking}
        thinkingLive={thinkingLive}
        thinkingStartedAt={thinkingStartedAt}
        thinkingDurationMs={thinkingDurationMs}
        liveTools={liveTools}
        statusText={statusText}
        optimistic={optimistic}
        compacting={compacting}
        error={error}
        showThinking={showThinking}
        toolOutputsOpen={toolOutputsOpen}
        round={round}
        resolveAssetUrl={resolveAssetUrl}
        toolOutputs={toolOutputs}
        toolTimings={toolTimings}
        orphanToolIds={orphanToolIds}
      />

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
