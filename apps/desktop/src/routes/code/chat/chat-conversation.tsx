import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUp, Bot, ChevronDown, Clock, Loader2, Lock, MessagesSquare, Paperclip, Send, Square, SquarePen, Trash2 } from "lucide-react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useChat, type ToolEvent } from "./use-chat-panel";
import type { CodeMessage } from "../sidenav/use-session-list";
import { Badge } from "@/components/ui/badge";
import { CompactionBlock, type CompactionBlockMeta } from "@/components/compaction-block";
import { ClearBlock, type ClearBlockMeta } from "@/components/clear-block";
import { AskUserWizard } from "./ask-user-wizard";
import { ErrorBoundary } from "@/components/error-boundary";
import { SystemPromptBlock } from "./system-prompt-block";
import { BtwDialog } from "./btw-dialog";
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

/** Expanded skills on a user message render as chips — content stays in the
 * dialog (click), never inline. */
function SkillChipButton({ skill, onOpen }: { skill: { name: string; content: string }; onOpen: (s: { name: string; content: string }) => void }) {
  return (
    <button
      type="button"
      className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-[0.1rem] font-medium text-primary transition-colors hover:bg-primary/20"
      onClick={() => onOpen(skill)}
      title="Show skill content"
    >
      /{skill.name}
    </button>
  );
}

function Message({
  role,
  content,
  resolveAssetUrl,
  label,
  skills,
  onSkillClick,
}: {
  role: string;
  content: string;
  resolveAssetUrl?: (uri: string) => string | undefined;
  label?: string;
  skills?: { name: string; content: string }[];
  onSkillClick?: (s: { name: string; content: string }) => void;
}) {
  const isUser = role === "user";
  if (isUser) {
    // Skill blocks hide from the rendered message — chips stand in for them.
    const stripped = skills?.length ? content.replace(/<skill name="[\w.-]+">[\s\S]*?<\/skill>/g, "").trim() : content;
    return (
      <div className="flex flex-col items-end">
        <div className="bg-card max-w-[85%] rounded-lg px-3 py-2 text-right">
          <span className="text-primary text-[11px] w-full font-semibold tracking-wide uppercase">{label ?? "You"}</span>
          {skills?.length ? (
            <div className="flex flex-wrap justify-end gap-1.5 pb-1">
              {skills.map((s) => (
                <SkillChipButton key={s.name} skill={s} onOpen={(x) => onSkillClick?.(x)} />
              ))}
            </div>
          ) : null}
          {stripped && <MessageMarkdown text={stripped} resolveAssetUrl={resolveAssetUrl} />}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{label ?? "Agent"}</span>
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
        itemContent={(_, row) => <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-2">{renderRow(row)}</div>}
      />
      {showJump && (
        <button
          className="bg-card text-muted-foreground hover:text-foreground absolute right-4 bottom-4 z-10 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-sm"
          onClick={() => {
            followingRef.current = true;
            userScrollRef.current = false;
            const el = scrollerElRef.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            else virtuoso.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "smooth" });
            setAtBottom(true);
            setShowJump(false);
          }}
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
    const out: RenderRow[] = [];
    let lastClearIdx = -1;
    for (let i = 0; i < list.length; i++) if (list[i].role === "clear") lastClearIdx = i;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.role === "tool" && !orphans.has(m.id)) continue;
      if (m.role === "ask_user") continue;
      if (m.role === "compaction" && !(m.meta as CompactionBlockMeta | null)?.summary) continue;
      out.push({ message: m, dimmed: lastClearIdx >= 0 && i < lastClearIdx });
    }
    return out;
  }

  function renderRow(row: RenderRow) {
    const m = row.message;
    if (m.role === "clear") return <ClearBlock meta={m.meta as ClearBlockMeta | null} />;
    if (m.role === "compaction") return <CompactionBlock meta={m.meta as unknown as CompactionBlockMeta} />;
    if (m.role === "btw") {
      const meta = m.meta as { agentName?: string; btwSessionId?: string; closed?: boolean } | null;
      return (
        <div className={row.dimmed ? "opacity-60" : undefined}>
          <button
            className="hover:bg-accent/50 flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors"
            onClick={() => meta?.btwSessionId && onOpenBtw?.(meta.btwSessionId)}
            title="Open the side thread"
          >
            <MessagesSquare size={13} className="text-primary shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="font-medium">/btw — Agent {meta?.agentName ?? "Agent"}</span>
              <span className="text-muted-foreground ml-2">{meta?.closed ? "closed" : "open"}</span>
              {m.content && <span className="text-muted-foreground block truncate text-[11px]">{m.content.slice(0, 120)}</span>}
            </span>
            <Lock size={12} className="text-muted-foreground shrink-0" aria-hidden="true" />
          </button>
        </div>
      );
    }
    if (m.role === "error") {
      // Provider failure / retry attempt — UI-only, never sent to the model.
      const meta = m.meta as { attempt?: number; maxRetries?: number; delayMs?: number; status?: number; final?: boolean } | null;
      const retrying = !meta?.final && meta?.attempt != null;
      return (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
            retrying ? "border-amber-500/40 bg-amber-500/5" : "border-destructive/40 bg-destructive/5",
            row.dimmed && "opacity-60",
          )}
          role="alert"
        >
          <AlertTriangle size={13} className={cn("mt-0.5 shrink-0", retrying ? "text-amber-500" : "text-destructive")} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className={cn("font-medium", retrying ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>
              {retrying
                ? `Request failed — retry ${meta!.attempt}/${meta!.maxRetries ?? "?"}${meta?.delayMs != null ? ` in ${Math.max(1, Math.round(meta.delayMs / 1000))}s` : ""}`
                : "Agent run failed"}
            </span>
            <span className="text-muted-foreground mt-0.5 block font-mono text-[11px] break-all whitespace-pre-wrap">{m.content}</span>
          </span>
          <span className="text-muted-foreground/70 shrink-0 text-[10px]">{new Date(m.createdAt).toLocaleTimeString()}</span>
        </div>
      );
    }
    if (m.role === "btw_done") {
      const meta = m.meta as { agentName?: string; sendToMain?: boolean } | null;
      return (
        <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs italic">
          <Lock size={12} aria-hidden="true" />
          thread closed{meta?.sendToMain ? " — summary sent to main" : ""}
        </div>
      );
    }
    if (m.role === "subagent") {
      const meta = m.meta as { subagentSessionId?: string; agentName?: string; agentType?: string; prompt?: string } | null;
      return (
        <div className={row.dimmed ? "opacity-60" : undefined}>
          <button
            className="hover:bg-accent/50 flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors"
            onClick={() => meta?.subagentSessionId && onOpenBtw?.(meta.subagentSessionId)}
            title="Open the subagent session — live while it runs"
          >
            <Bot size={13} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="font-medium">subagent — {meta?.agentName ?? "agent"}</span>
              <span className="text-muted-foreground ml-2 font-mono text-[10px]">{meta?.agentType}</span>
              {meta?.prompt && <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">{meta.prompt}</span>}
            </span>
            <ChevronDown size={12} className="text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          </button>
        </div>
      );
    }
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
      btw?: { agentName?: string; btwSessionId?: string; sendToMain?: boolean };
    } | null;
    return (
      <div className={cn("flex flex-col gap-4", row.dimmed && "opacity-60")}>
        {meta?.thinking?.map((t, i) => (
          <ThinkingBlock key={i} text={t.text} live={false} durationMs={t.durationMs} visible={showThinking} />
        ))}
        {m.content && (
          <Message
            role={m.role}
            content={m.content}
            resolveAssetUrl={resolveAssetUrl}
            label={meta?.btw?.agentName ? `Agent ${meta.btw.agentName}` : undefined}
            skills={m.role === "user" ? ((m.meta as { skills?: { name: string; content: string }[] } | null)?.skills ?? undefined) : undefined}
            onSkillClick={onSkillClick}
          />
        )}
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
      </div>
    );
  }
}

interface RenderRow {
  message: CodeMessage;
  dimmed: boolean;
}

export function ChatConversation() {
  const { sessionId } = useParams<{ sessionId: string }>();
  if (!sessionId) return null;
  return <ChatConversationInner sessionId={sessionId} />;
}

/** The full chat panel (message list + composer + footer) for one session —
 * used by the main route AND the /btw dialog (a second session's chat). */
export function ChatConversationInner({ sessionId }: { sessionId: string }) {
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
    steering,
    sendSteeringNow,
    removeSteering,
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
    <div className="flex min-h-0 flex-1 flex-col">
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
        toolTimings={toolTimings}
        orphanToolIds={orphanToolIds}
        onOpenBtw={openBtwSession}
        onSkillClick={setViewSkill}
      />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
        {askUser ? (
          <ErrorBoundary
            name="ask-user-wizard"
            resetKeys={[askUser.id]}
            fallback={({ error, reset }) => (
              <div className="bg-card border-destructive/50 flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-xs">
                <p className="text-destructive font-semibold">The agent's question couldn't be displayed.</p>
                <p className="text-muted-foreground font-mono break-words">{error.message}</p>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={reset}>
                    Retry
                  </Button>
                  <Button variant="destructive" size="sm" className="ml-auto" title="Stop the run without answering" onClick={stop}>
                    <Square size={12} /> Stop
                  </Button>
                </div>
              </div>
            )}
          >
            {/* keyed by tool-call id: a new question remounts with fresh step/answers state */}
            <AskUserWizard key={askUser.id} questions={askUser.questions} onSubmit={answerAskUser} onStop={stop} />
          </ErrorBoundary>
        ) : (
          <div className="flex flex-col gap-2">
            {steering.length > 0 && (
              <div className="bg-card/60 flex flex-col gap-1 rounded-lg border border-dashed p-2">
                {steering.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 text-xs">
                    <Badge variant="secondary" className="mt-0.5 shrink-0 gap-1 font-mono">
                      <Clock size={10} aria-hidden="true" /> queued
                    </Badge>
                    <p className="min-w-0 flex-1 whitespace-pre-wrap break-words pt-0.5 font-mono">{item.content}</p>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button variant="ghost" size="icon-sm" title="Send now — stops the run and dispatches" onClick={sendSteeringNow}>
                        <Send size={12} />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="hover:text-destructive" title="Delete" onClick={() => removeSteering(item.id)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                  <>
                    <Button size="icon-sm" variant="destructive" title="Stop" onClick={stop}>
                      <Square size={12} />
                    </Button>
                    <Button
                      size="icon-sm"
                      className="ml-auto"
                      title={steering.length > 0 ? "Send queued messages now" : "Queue message — sent when this round finishes"}
                      onClick={steering.length > 0 ? sendSteeringNow : submit}
                      disabled={!draft.trim() && steering.length === 0}
                    >
                      <ArrowUp size={14} />
                    </Button>
                  </>
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
      </div>
    </div>
  );
}
