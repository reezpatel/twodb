import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Cpu, HardDrive, MemoryStick, MonitorCog, Paperclip, Square } from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useChat, type ToolEvent } from "./use-chat-panel";
import type { CodeMessage } from "../sidenav/use-session-list";
import { ToolView } from "./tools/tool-views";
import { ChatMessage, type MessageSkill } from "./messages/chat-message";
import { ChatThinking } from "./messages/chat-thinking";
import { ChatSystemPrompt } from "./messages/chat-system-prompt";
import {
  ChatBtw,
  ChatBtwDone,
  ChatClear,
  ChatCompaction,
  ChatError,
  ChatSubagent,
  type ClearMeta,
  type ErrorMeta,
  type CompactionMeta,
} from "./messages/chat-context-rows";
import { CodeChatLive, CodeChatProgress } from "@/components/blocks/code/code-chat/code-chat-live";
import { CodeChatJumpButton, CodeChatThreadHeader, CodeChatThreadRow } from "@/components/blocks/code/code-chat/code-chat-thread";
import { CodeChatToolsOpenProvider } from "@/components/blocks/code/code-chat/code-chat-tools-open";
import { AskUserWizard } from "./ask-user-wizard";
import { ErrorBoundary } from "@/components/error-boundary";
import { BtwDialog } from "./btw-dialog";
import { CHAT_COMPOSER_COMMANDS } from "@/components/blocks/composer/composer-commands";
import { useModelConfig } from "@/components/model-picker/use-model-config";
import { useChatModelPicker } from "./use-chat-model-picker";
import { useChatFooterStatus, type FooterMetricKind } from "./use-chat-footer-status";
import { useEscapeKey } from "@/lib/use-escape-key";
import { CodeChatShell } from "@/components/blocks/code/code-chat/code-chat-shell";
import { CodeChatFooter, CodeChatReconnecting, CodeChatStatusBar } from "@/components/blocks/code/code-chat-footer/code-chat-footer";
import { CodeChatUsage, CodeChatUsageContext, CodeChatUsageSpacer, CodeChatUsageStat } from "@/components/blocks/code/code-chat-footer/code-chat-usage";
import {
  CodeChatResourceMetric,
  CodeChatResourceRunner,
  CodeChatResources,
  CodeChatResourcesEmpty,
  CodeChatResourcesSettings,
  CodeChatResourcesSettingsEmpty,
  CodeChatResourcesSettingsRunner,
  CodeChatResourcesSettingsToggle,
} from "@/components/blocks/code/code-chat-footer/code-chat-resources";
import { ModelPicker } from "@/components/blocks/model-picker/model-picker";
import { ModelPickerTrigger } from "@/components/blocks/model-picker/model-picker-trigger";
import {
  CodeChatComposer,
  CodeChatComposerActions,
  CodeChatComposerInput,
  CodeChatComposerSpacer,
} from "@/components/blocks/code/code-chat-footer/code-chat-composer";
import { CodeChatComposerAction } from "@/components/blocks/code/code-chat-footer/code-chat-composer-action";
import { CodeChatComposerSend } from "@/components/blocks/code/code-chat-footer/code-chat-composer-send";
import { CodeChatComposerStop } from "@/components/blocks/code/code-chat-footer/code-chat-composer-stop";
import { CodeChatAttachment, CodeChatAttachments, CodeChatAttachmentUploading } from "@/components/blocks/code/code-chat-footer/code-chat-attachments";
import { CodeChatQuestionAction, CodeChatQuestionError } from "@/components/blocks/code/code-chat-footer/code-chat-question";
import { CodeChatQueue } from "@/components/blocks/code/code-chat-footer/code-chat-queue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useComposer } from "@/components/blocks/composer/use-composer";
import type { PasteRef } from "@/components/blocks/composer/paste-chip";
import { useDirectoryFiles } from "./composer/use-directory-files";
import { api } from "@/lib/api";
import { assetUrl } from "@/lib/native";

const RESOURCE_ICONS: Record<FooterMetricKind, ReactNode> = {
  cpu: <Cpu />,
  memory: <MemoryStick />,
  gpu: <MonitorCog />,
  disk: <HardDrive />,
};

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
  toolDiffs: Map<string, string>;
  orphanToolIds: Set<string>;
  /** Opens the /btw side thread when its block is clicked (main thread only). */
  onOpenBtw?: (sessionId: string) => void;
  /** Opens the skill-content dialog when a skill chip is clicked. */
  onSkillClick?: (skill: { name: string; content: string }) => void;
}

/**
 * The transcript: virtualized (only ~10 rows above/below the viewport mount),
 * stick-to-bottom while the user is at the end (streaming keeps scrolling),
 * static once they scroll away, with a jump-to-latest affordance.
 */
function ChatMessageList(props: ChatMessageListProps) {
  const { messages, hasOlder, loadingOlder, loadOlder, streaming, running, optimistic, compacting, error } = props;
  const {
    thinking,
    thinkingLive,
    thinkingStartedAt,
    thinkingDurationMs,
    liveTools,
    statusText,
    showThinking,
    toolOutputsOpen,
    round,
    resolveAssetUrl,
    toolOutputs,
    toolTimings,
    toolDiffs,
    orphanToolIds,
    onOpenBtw,
    onSkillClick,
  } = props;
  const virtuoso = useRef<VirtuosoHandle>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const rows = useMemo(() => renderableRows(messages, orphanToolIds), [messages, orphanToolIds]);

  // Sticky-bottom that survives footer growth. The streaming message renders
  // in the Footer (not data), so followOutput/scrollToIndex can't track it,
  // and Virtuoso's atBottom flips false on every reflow — which killed the
  // auto-scroll mid-stream. Instead: pin to the scroller's absolute bottom on
  // every delta, and only unpin on real user intent (wheel/touch/scroll keys)
  // — programmatic scrolls and content-growth reflows don't touch the pin.
  const scrollerElRef = useRef<HTMLElement | null>(null);
  const followingRef = useRef(true);
  const userScrollRef = useRef(false);
  const scrollHandlersRef = useRef<{
    el: HTMLElement;
    onScroll: () => void;
    markUser: () => void;
    onKey: (e: KeyboardEvent) => void;
  } | null>(null);

  const bindScroller = (el: HTMLElement | null) => {
    if (scrollHandlersRef.current?.el === el) return;
    const prev = scrollHandlersRef.current;
    if (prev) {
      prev.el.removeEventListener("wheel", prev.markUser);
      prev.el.removeEventListener("touchmove", prev.markUser);
      prev.el.removeEventListener("keydown", prev.onKey);
      prev.el.removeEventListener("scroll", prev.onScroll);
      scrollHandlersRef.current = null;
    }
    scrollerElRef.current = el;
    scrollerHeightRef.current = el ? el.clientHeight : 0;
    if (!el) return;
    const onScroll = () => {
      if (!userScrollRef.current) return; // programmatic/reflow scrolls don't unpin
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distance < 40) {
        followingRef.current = true;
        userScrollRef.current = false;
        setAtBottom(true);
        setShowJump(false);
      } else {
        followingRef.current = false;
        setAtBottom(false);
        setShowJump(true);
      }
    };
    const markUser = () => {
      userScrollRef.current = true;
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) userScrollRef.current = true;
    };
    el.addEventListener("wheel", markUser, { passive: true });
    el.addEventListener("touchmove", markUser, { passive: true });
    el.addEventListener("keydown", onKey);
    el.addEventListener("scroll", onScroll, { passive: true });
    scrollHandlersRef.current = { el, onScroll, markUser, onKey };
  };

  useEffect(() => {
    const el = scrollerElRef.current;
    if (el && followingRef.current) el.scrollTop = el.scrollHeight;
  }, [rows, streaming, liveTools, thinking, optimistic, compacting, statusText]);

  // A fresh session always starts pinned.
  useEffect(() => {
    followingRef.current = true;
    userScrollRef.current = false;
  }, [messages.length === 0]);

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
    <CodeChatToolsOpenProvider open={toolOutputsOpen || undefined}>
      <div className="relative min-h-0 flex-1">
        <Virtuoso
          ref={virtuoso}
          className="h-full"
          initialTopMostItemIndex={Number.MAX_SAFE_INTEGER}
          firstItemIndex={firstItemIndex}
          startReached={startReached}
          rangeChanged={(range) => {
            setShowJump(range.endIndex < rows.length - 4 && !atBottom);
            // Near-top triggers backfill even when the list is too short to
            // ever produce a startReached scroll event.
            if (range.startIndex <= 2 && hasOlder && !loadingOlder) loadOlder();
          }}
          increaseViewportBy={{ top: 600, bottom: 600 }}
          totalListHeightChanged={(h) => (totalListHeightRef.current = h)}
          scrollerRef={(el) => bindScroller(el instanceof HTMLElement ? el : null)}
          components={{
            Header: () => (
              <CodeChatThreadHeader>{loadingOlder ? "loading earlier messages…" : hasOlder ? "scroll up for earlier messages" : null}</CodeChatThreadHeader>
            ),
            Footer: () => (
              <div className="pb-6">
                {optimistic && (
                  <CodeChatThreadRow>
                    <ChatMessage role="user" content={optimistic.content} resolveAssetUrl={resolveAssetUrl} />
                  </CodeChatThreadRow>
                )}
                {compacting && (
                  <CodeChatThreadRow>
                    <CodeChatProgress>compacting context…</CodeChatProgress>
                  </CodeChatThreadRow>
                )}
                {running && (
                  <>
                    <CodeChatThreadRow>
                      <CodeChatLive>Live{round !== null ? ` · round ${round}` : ""}</CodeChatLive>
                    </CodeChatThreadRow>
                    {liveTools.map((t) => (
                      <CodeChatThreadRow key={t.id}>
                        <ToolView
                          name={t.name}
                          args={t.args}
                          output={t.output}
                          diff={t.diff}
                          running={!t.done}
                          startedAt={t.startedAt}
                          completedAt={t.completedAt}
                          failed={t.status === "failed"}
                          defaultOpen={toolOutputsOpen}
                        />
                      </CodeChatThreadRow>
                    ))}
                    {thinking !== null && (
                      <CodeChatThreadRow>
                        <ChatThinking
                          text={thinking}
                          live={thinkingLive}
                          startedAt={thinkingStartedAt ?? undefined}
                          durationMs={thinkingDurationMs ?? undefined}
                          visible={showThinking}
                        />
                      </CodeChatThreadRow>
                    )}
                    <CodeChatThreadRow>
                      {streaming ? (
                        <ChatMessage role="assistant" content={streaming} resolveAssetUrl={resolveAssetUrl} />
                      ) : (
                        <CodeChatProgress look={{ state: "reasoning" }}>thinking</CodeChatProgress>
                      )}
                    </CodeChatThreadRow>
                    {statusText && (
                      <CodeChatThreadRow>
                        <CodeChatProgress look={{}}>{statusText}</CodeChatProgress>
                      </CodeChatThreadRow>
                    )}
                  </>
                )}
              </div>
            ),
            EmptyPlaceholder: () => (
              <CodeChatThreadRow>
                <ChatSystemPrompt />
              </CodeChatThreadRow>
            ),
          }}
          data={rows}
          itemContent={(_, row) => renderRow(row)}
        />
        {showJump && (
          <CodeChatJumpButton
            onClick={() => {
              followingRef.current = true;
              userScrollRef.current = false;
              const el = scrollerElRef.current;
              if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
              else virtuoso.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "smooth" });
              setAtBottom(true);
              setShowJump(false);
            }}
          />
        )}
        {error && (
          <p className="text-destructive absolute top-2 right-4 z-10 text-xs" role="alert">
            {error}
          </p>
        )}
      </div>
    </CodeChatToolsOpenProvider>
  );

  function renderableRows(list: CodeMessage[], orphans: Set<string>) {
    const out: RenderRow[] = [];
    let lastClearIdx = -1;
    for (let i = 0; i < list.length; i++) if (list[i].role === "clear") lastClearIdx = i;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.role === "tool" && !orphans.has(m.id)) continue;
      if (m.role === "ask_user") continue;
      if (m.role === "compaction" && !(m.meta as CompactionMeta | null)?.summary) continue;
      out.push({ message: m, dimmed: lastClearIdx >= 0 && i < lastClearIdx });
    }
    return out;
  }

  function renderRow(row: RenderRow) {
    const m = row.message;
    const dimmed = row.dimmed;

    if (m.role === "clear") {
      return (
        <Row dimmed={dimmed}>
          <ChatClear meta={m.meta as ClearMeta | null} />
        </Row>
      );
    }
    if (m.role === "compaction") {
      return (
        <Row dimmed={dimmed}>
          <ChatCompaction meta={m.meta as unknown as CompactionMeta} />
        </Row>
      );
    }
    if (m.role === "btw") {
      const meta = m.meta as { agentName?: string; btwSessionId?: string; closed?: boolean } | null;
      return (
        <Row dimmed={dimmed}>
          <ChatBtw
            agentName={meta?.agentName}
            closed={meta?.closed}
            preview={m.content?.slice(0, 120) || undefined}
            onOpen={() => meta?.btwSessionId && onOpenBtw?.(meta.btwSessionId)}
          />
        </Row>
      );
    }
    if (m.role === "error") {
      return (
        <Row dimmed={dimmed}>
          <ChatError meta={m.meta as ErrorMeta | null} content={m.content} createdAt={m.createdAt} />
        </Row>
      );
    }
    if (m.role === "btw_done") {
      const meta = m.meta as { sendToMain?: boolean } | null;
      return (
        <Row dimmed={dimmed}>
          <ChatBtwDone sendToMain={meta?.sendToMain} />
        </Row>
      );
    }
    if (m.role === "subagent") {
      const meta = m.meta as { subagentSessionId?: string; agentName?: string; agentType?: string; prompt?: string } | null;
      return (
        <Row dimmed={dimmed}>
          <ChatSubagent
            name={meta?.agentName}
            agentType={meta?.agentType}
            prompt={meta?.prompt}
            onOpen={() => meta?.subagentSessionId && onOpenBtw?.(meta.subagentSessionId)}
          />
        </Row>
      );
    }
    if (m.role === "tool") {
      const meta = m.meta as { name?: string; startedAt?: number; completedAt?: number; status?: string; diff?: string } | null;
      return (
        <Row dimmed={dimmed}>
          <ToolView
            name={meta?.name ?? "tool"}
            output={m.content}
            diff={meta?.diff}
            startedAt={meta?.startedAt}
            completedAt={meta?.completedAt}
            failed={meta?.status === "failed"}
            defaultOpen={toolOutputsOpen}
          />
        </Row>
      );
    }
    const meta = m.meta as {
      toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
      thinking?: { text: string; durationMs?: number }[];
      stopped?: boolean;
      btw?: { agentName?: string; btwSessionId?: string; sendToMain?: boolean };
    } | null;
    return (
      <>
        {meta?.thinking
          ?.filter((t) => t.text?.trim())
          .map((t, i) => (
            <Row dimmed={dimmed} key={`thinking-${i}`}>
              <ChatThinking text={t.text} live={false} durationMs={t.durationMs} visible={showThinking} />
            </Row>
          ))}
        {m.content && (
          <Row dimmed={dimmed}>
            <ChatMessage
              role={m.role}
              content={m.content}
              resolveAssetUrl={resolveAssetUrl}
              label={meta?.btw?.agentName ? `Agent ${meta.btw.agentName}` : undefined}
              skills={m.role === "user" ? ((m.meta as { skills?: MessageSkill[] } | null)?.skills ?? undefined) : undefined}
              onSkillClick={onSkillClick}
            />
          </Row>
        )}
        {meta?.stopped && (
          <Row dimmed={dimmed}>
            <span className="text-muted-foreground/70 text-[13px] italic">stopped</span>
          </Row>
        )}
        {meta?.toolCalls?.map((tc) => {
          const timing = toolTimings.get(tc.id);
          return (
            <Row dimmed={dimmed} key={tc.id}>
              <ToolView
                name={tc.name}
                args={tc.arguments}
                output={toolOutputs.get(tc.id)}
                diff={toolDiffs.get(tc.id)}
                startedAt={timing?.startedAt}
                completedAt={timing?.completedAt}
                failed={timing?.status === "failed"}
                defaultOpen={toolOutputsOpen}
              />
            </Row>
          );
        })}
      </>
    );
  }
}

function Row({ dimmed, children }: { dimmed: boolean; children: ReactNode }) {
  return <CodeChatThreadRow dimmed={dimmed}>{children}</CodeChatThreadRow>;
}

interface RenderRow {
  message: CodeMessage;
  dimmed: boolean;
}

/** The full chat panel (message list + composer + footer) for one session —
 * used by the main route AND the /btw dialog (a second session's chat). */
export function ChatConversationInner({ sessionId }: { sessionId: string }) {
  // Asset links become fetchable URLs (image thumbnails inline).
  const resolveAssetUrl = (uri: string) => {
    if (uri.includes("/api/storage/resolve/")) return assetUrl(uri);
    const match = /^twodb:\/\/[^/]+\/([^/]+)$/.exec(uri);
    return match?.[1] ? assetUrl(`/api/code/sessions/${sessionId}/assets/${match[1]}`) : undefined;
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
    skillCommands,
    send,
    stop,
    steering,
    sendSteeringNow,
    removeSteering,
    reorderSteering,
    moveSteeringToTop,
    openBtwSession,
    // /btw side thread
    btw,
    startBtw,
    closeBtw,
    visibleMessages: messages,
    hasOlder,
    loadingOlder,
    loadOlder,
  } = useChat();
  const [viewPaste, setViewPaste] = useState<PasteRef | null>(null);
  const [viewSkill, setViewSkill] = useState<{ name: string; content: string } | null>(null);
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
  const { connections, selected, effectiveModel, model, thinkingLevel, contextWindow } = config;
  const modelPicker = useChatModelPicker(config);
  const footerStatus = useChatFooterStatus(stats, contextWindow);

  // Committed tool calls render as ONE block: the assistant message's
  // meta.toolCalls carry the request, the following role="tool" messages carry
  // the output. Two O(n) passes, memoized on the accumulated history identity.
  const { toolOutputs, toolTimings, toolDiffs, orphanToolIds } = useMemo(() => {
    const outputs = new Map<string, string>();
    const timings = new Map<string, { startedAt?: number; completedAt?: number; status?: string }>();
    const diffs = new Map<string, string>();
    const callIds = new Set<string>();
    for (const m of messages) {
      if (m.role === "tool") {
        const meta = m.meta as { toolCallId?: string; startedAt?: number; completedAt?: number; status?: string; diff?: string } | null;
        if (meta?.toolCallId) {
          outputs.set(meta.toolCallId, m.content);
          timings.set(meta.toolCallId, { startedAt: meta.startedAt, completedAt: meta.completedAt, status: meta.status });
          if (meta.diff) diffs.set(meta.toolCallId, meta.diff);
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
    return { toolOutputs: outputs, toolTimings: timings, toolDiffs: diffs, orphanToolIds: orphans };
  }, [messages]);

  const running = streaming !== null;
  useEscapeKey(stop, running && !askUser);

  const directoryId = session.data?.codeDirectoryId ?? null;
  const filesQuery = useDirectoryFiles(directoryId);
  // Live skills from the session (DB + runner) lead the palette; built-ins follow.
  const composerCommands = useMemo(() => [...skillCommands, ...CHAT_COMPOSER_COMMANDS], [skillCommands]);
  const { editor, submit, pastes } = useComposer({
    files: filesQuery.data?.files ?? [],
    commands: composerCommands,
    disabled: compacting || connections.length === 0,
    placeholder:
      connections.length === 0
        ? "Add an LLM connection in Settings → LLM first"
        : running
          ? "Steering — message queues until this round finishes"
          : "Ask the agent… — @ files, / commands",
    onSkillClick: setViewSkill,
    loadSkillContent: (name) =>
      directoryId
        ? api<{ name: string; content: string }>(`/api/code/directories/${directoryId}/repo-skills/${encodeURIComponent(name)}`)
            .then((r) => r.content)
            .catch(() => null)
        : Promise.resolve(null),
    onDraft: setDraft,
    onSend: (content, skills) => send(selected?.id, model || effectiveModel, thinkingLevel, content, skills),
  });

  return (
    <CodeChatShell>
      <ChatMessageList
        messages={messages}
        hasOlder={hasOlder}
        loadingOlder={loadingOlder}
        loadOlder={loadOlder}
        sessionId={sessionId}
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
        toolDiffs={toolDiffs}
        toolTimings={toolTimings}
        orphanToolIds={orphanToolIds}
        onOpenBtw={openBtwSession}
        onSkillClick={setViewSkill}
      />

      <CodeChatFooter>
        {wsStatus === "closed" ? <CodeChatReconnecting /> : null}
        {askUser ? (
          <ErrorBoundary
            name="ask-user-wizard"
            resetKeys={[askUser.id]}
            fallback={({ error, reset }) => (
              <CodeChatQuestionError title="The agent's question couldn't be displayed." message={error.message}>
                <Button variant="ghost" size="sm" onClick={reset}>
                  Retry
                </Button>
                <CodeChatQuestionAction
                  kind="stop"
                  label="Stop"
                  icon={<Square className="fill-current" />}
                  title="Stop the run without answering"
                  onClick={stop}
                />
              </CodeChatQuestionError>
            )}
          >
            {/* keyed by tool-call id: a new question remounts with fresh step/answers state */}
            <AskUserWizard key={askUser.id} questions={askUser.questions} files={filesQuery.data?.files ?? []} onSubmit={answerAskUser} onStop={stop} />
          </ErrorBoundary>
        ) : (
          <>
            {steering.length > 0 && (
              <CodeChatQueue
                items={steering.map(({ id, content, assets }) => ({ id, content, attachments: assets.length || undefined }))}
                onReorder={(next) => reorderSteering(next.map((q) => q.id))}
                onMoveToTop={moveSteeringToTop}
                onRemove={removeSteering}
                onSendNow={sendSteeringNow}
              />
            )}
            <CodeChatComposer busy={running}>
              {(pendingAssets.length > 0 || uploadingAssets) && (
                <CodeChatAttachments>
                  {pendingAssets.map((asset) => (
                    <CodeChatAttachment key={asset.uri} name={asset.filename} previewUrl={asset.localPreview} onRemove={() => removeAsset(asset.uri)} />
                  ))}
                  {uploadingAssets && <CodeChatAttachmentUploading />}
                </CodeChatAttachments>
              )}
              <input
                ref={assetInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) void uploadAssets(e.target.files);
                  e.target.value = "";
                }}
              />
              <CodeChatComposerInput editor={editor} onPasteClick={(id) => setViewPaste(pastes.current.get(id) ?? null)} />
              <CodeChatComposerActions>
                <CodeChatComposerAction
                  icon={<Paperclip />}
                  label="Attach files"
                  loading={uploadingAssets}
                  disabled={uploadingAssets}
                  onClick={() => assetInputRef.current?.click()}
                />
                <CodeChatComposerSpacer />
                {running && <CodeChatComposerStop onClick={stop} />}
                {running ? (
                  <CodeChatComposerSend
                    label={steering.length > 0 ? "Send queued messages now" : "Queue message — sent when this round finishes"}
                    disabled={!draft.trim() && steering.length === 0}
                    onClick={steering.length > 0 ? sendSteeringNow : submit}
                  />
                ) : (
                  <CodeChatComposerSend label="Send" disabled={!draft.trim() || !selected || !effectiveModel || wsStatus !== "open"} onClick={submit} />
                )}
              </CodeChatComposerActions>
            </CodeChatComposer>
          </>
        )}

        <CodeChatStatusBar>
          <CodeChatUsage>
            <CodeChatUsageStat title="Input tokens (incl. cached)">↑ {footerStatus.usage.input}</CodeChatUsageStat>
            <CodeChatUsageStat title="Output tokens">↓ {footerStatus.usage.output}</CodeChatUsageStat>
            <CodeChatUsageStat title="Cache hit — cached input / total input">⚡ {footerStatus.usage.cache}</CodeChatUsageStat>
            <CodeChatUsageStat title="Generation speed">{footerStatus.usage.speed}</CodeChatUsageStat>
            <CodeChatUsageContext
              percent={footerStatus.usage.contextPercent}
              label={footerStatus.usage.contextLabel}
              title="Context consumed vs the model's context window"
            />
            <CodeChatUsageSpacer />
            <ModelPicker {...modelPicker}>
              <ModelPickerTrigger size="sm" />
            </ModelPicker>
          </CodeChatUsage>
          <CodeChatResources>
            {footerStatus.machines.length === 0 && <CodeChatResourcesEmpty>{footerStatus.resourcesEmptyText}</CodeChatResourcesEmpty>}
            {footerStatus.machines.map((machine) => (
              <CodeChatResourceRunner key={machine.id} name={machine.name}>
                {machine.metrics.map((metric) => (
                  <CodeChatResourceMetric key={metric.key} label={metric.label} percent={metric.percent} value={metric.value} />
                ))}
              </CodeChatResourceRunner>
            ))}
            <CodeChatResourcesSettings>
              {footerStatus.machines.length === 0 && <CodeChatResourcesSettingsEmpty>{footerStatus.resourcesSettingsEmptyText}</CodeChatResourcesSettingsEmpty>}
              {footerStatus.machines.map((machine) => (
                <CodeChatResourcesSettingsRunner key={machine.id} name={machine.name}>
                  {machine.toggles.map((toggle) => (
                    <CodeChatResourcesSettingsToggle
                      key={toggle.kind}
                      on={toggle.on}
                      onClick={() => footerStatus.toggleKind(machine.id, toggle.kind)}
                      icon={RESOURCE_ICONS[toggle.kind]}
                      label={toggle.label}
                    />
                  ))}
                </CodeChatResourcesSettingsRunner>
              ))}
            </CodeChatResourcesSettings>
          </CodeChatResources>
        </CodeChatStatusBar>
      </CodeChatFooter>

      {btw && (
        <BtwDialog
          btwSessionId={btw.sessionId}
          seed={btw.seed}
          onClose={closeBtw}
          onStart={(agentId, question) => void startBtw(agentId, question, directoryId)}
        />
      )}

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

      <Dialog open={!!viewSkill} onOpenChange={(o) => !o && setViewSkill(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>/{viewSkill?.name}</DialogTitle>
          </DialogHeader>
          <pre className="bg-muted max-h-[60vh] overflow-auto rounded-lg p-3 font-mono text-xs whitespace-pre-wrap">{viewSkill?.content}</pre>
        </DialogContent>
      </Dialog>
    </CodeChatShell>
  );
}
