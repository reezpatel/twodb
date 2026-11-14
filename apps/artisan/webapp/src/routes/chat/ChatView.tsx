import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Scissors } from "lucide-react";
import { Markdown, ThinkingState } from "@twodb/blocks";
import { toolToNode, thinkingToNode, liveToolToNode, type ToolCallMeta, type ThinkingMeta } from "./trace.js";
import { useSessionChat } from "./hooks/useSessionChat.js";
import { useCatalog } from "../shell/hooks/useCatalog.js";
import { ChatShell, ChatThread, ChatThreadRow, ChatThreadHeader } from "./partials/ChatShell.js";
import { ChatHeader, ChatHeaderTitle, ChatHeaderStatus, ChatHeaderActions, ChatHeaderAction } from "./partials/ChatHeader.js";
import { ChatFooter, ChatFooterNotice, ChatReconnecting, ChatStatusBar } from "./partials/ChatFooter.js";
import { AttachmentChips, MentionPopup, QueuePills } from "./partials/ChatAttachments.js";
import { useDirectoryFiles, buildAttachmentBlock } from "./hooks/useDirectoryFiles.js";
import { useWorkspaceWs } from "../../lib/workspace-ws.js";
import { ChatComposer, ChatComposerInput, ChatComposerActions, ChatComposerSpacer, ChatComposerSend, ChatComposerStop } from "./partials/ChatComposer.js";
import { ChatUsage, ChatUsageStat, ChatUsageContext, ChatUsageSpacer } from "./partials/ChatUsage.js";
import { ChatMessage } from "./partials/ChatMessage.js";
import { AskWidget } from "./partials/AskWidget.js";
import { ModelPicker, type ModelProvider, type ModelEntry } from "@twodb/blocks";

/** Legacy token formatting: 1.2k / 3.4M (never raw thousands). */
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Context chars → tokens estimate → % of the model's window. */
function contextPercent(usage: { inputTokens: number } | null, contextWindow: number | null): number | null {
  if (!usage || !contextWindow) return null;
  return Math.min(100, Math.round((usage.inputTokens / contextWindow) * 100));
}

/**
 * Legacy-style chat: centered transcript (user = right-shifted tinted
 * bubble, assistant = open text), bordered composer with Stop/Send, and a
 * usage status bar (↑ ↓ ⚡ + context ring + model picker).
 */
export function ChatView(props: { sessionId: string; noHeader?: boolean }) {
  const chat = useSessionChat(props.sessionId);
  const { connected } = useWorkspaceWs();
  const catalog = useCatalog();
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [tokPerSec, setTokPerSec] = useState<number | null>(null);
  const liveDeltaRef = useRef({ count: 0, startedAt: 0 });
  const [mentionIndex, setMentionIndex] = useState(0);
  const files = useDirectoryFiles(props.sessionId);

  useEffect(() => {
    setDraft("");
    setAttachments([]);
  }, [props.sessionId]);

  // Trailing `@query` (null when the composer isn't mentioning).
  const mentionQuery = (() => {
    const m = /(?:^|\s)@(\S*)$/.exec(draft);
    return m ? m[1] : null;
  })();
  const mentionMatches = mentionQuery === null
    ? []
    : files.filter((f) => f.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8);

  const pickMention = (index: number) => {
    const path = mentionMatches[index];
    if (!path) return;
    setDraft((d) => d.replace(/(?:^|\s)@\S*$/, " ").replace(/\s+$/, " "));
    setAttachments((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setMentionIndex(0);
  };

  const submit = () => {
    if (mentionQuery !== null && mentionMatches.length > 0) {
      pickMention(mentionIndex);
      return;
    }
    const text = draft.trim();
    if (!text && attachments.length === 0) return;
    const paths = attachments;
    setDraft("");
    setAttachments([]);
    if (!chat.running && text === "/new") void chat.newThread();
    else if (!chat.running && text === "/compact") void chat.compact();
    else if (paths.length === 0) void chat.send(text);
    else {
      // Fetch attached file contents and append as path-fenced blocks.
      void buildAttachmentBlock(props.sessionId, paths).then((block) => void chat.send(text + block));
    }
  };

  const detail = chat.detail;
  const plan = detail?.plan ?? null;

  // Group models into providers for the picker.
  const providers = useMemo<ModelProvider[]>(() => {
    const byConn = new Map<string, ModelEntry[]>();
    for (const m of catalog.models) {
      const list = byConn.get(m.connection) ?? [];
      list.push({
        id: m.id,
        label: m.name,
        context: m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k` : undefined,
        triggerLabel: m.id,
        thinking: m.thinking,
        thinkingLevels: m.thinkingLevel?.length ? m.thinkingLevel : undefined,
      });
      byConn.set(m.connection, list);
    }
    return [...byConn.entries()].map(([name, models]) => ({ id: name, title: name, models }));
  }, [catalog.models]);

  const modelInfo = catalog.models.find((m) => m.id === detail?.model);
  const ctxPct = contextPercent(chat.usage, modelInfo?.contextWindow ?? null);
  const cacheHit = chat.usage && chat.usage.inputTokens > 0 ? `${Math.round((chat.usage.cachedTokens / chat.usage.inputTokens) * 100)}%` : "—";

  // Generation speed: token/400ms window, reset on run start (legacy code-chat usage bar).
  useEffect(() => {
    if (chat.streamText && chat.running) {
      if (liveDeltaRef.current.count === 0) liveDeltaRef.current.startedAt = Date.now();
      liveDeltaRef.current.count += 1;
      const elapsed = Date.now() - liveDeltaRef.current.startedAt;
      if (elapsed > 400) setTokPerSec(Math.round((liveDeltaRef.current.count / elapsed) * 1000 * 10) / 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.streamText]);
  useEffect(() => {
    if (!chat.running) {
      setTokPerSec(null);
      liveDeltaRef.current.count = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.running]);

  return (
    <ChatShell>
      {props.noHeader ? null : (
      <ChatHeader>
        <ChatHeaderTitle
          title={detail?.title ?? props.sessionId.slice(-8)}
          sub={detail ? `${detail.runner}:${detail.directory}` : undefined}
        />
        {chat.running ? <span className="ml-2 flex items-center gap-1.5 text-xs text-ink-muted"><span className="size-1.5 animate-pulse rounded-full bg-success" />running</span> : null}
        <ChatHeaderActions>
          <ChatHeaderAction icon={<Sparkles className="size-3.5" />} label="New thread (/new)" onClick={() => void chat.newThread()} />
          <ChatHeaderAction icon={<Scissors className="size-3.5" />} label="Compact context (/compact)" onClick={() => void chat.compact()} />
        </ChatHeaderActions>
      </ChatHeader>
      )}

      {plan && plan.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-outline bg-surface-muted/50 px-4 py-1.5">
          {plan.map((step, i) => (
            <span
              key={i}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                step.status === "done" ? "text-ink-muted line-through" : step.status === "in_progress" ? "bg-info/15 text-ink" : "text-ink-muted"
              }`}
            >
              {step.status === "done" ? "✓" : step.status === "in_progress" ? "▸" : "·"} {step.description}
            </span>
          ))}
        </div>
      ) : null}

      <ChatThread className="overflow-y-auto" ref={chat.scroller}>
        {chat.messages.map((m) => (
          <ChatThreadRow key={m.id}>
            {m.role === "user" ? (
              <ChatMessage variant="user">{m.content}</ChatMessage>
            ) : m.role === "compaction" || m.role === "system" ? (
              <ChatThreadHeader>{m.content.slice(0, 240)}</ChatThreadHeader>
            ) : (
              <>
                {(() => {
                  const calls = (m.meta?.toolCalls as ToolCallMeta[] | undefined) ?? [];
                  const thinking = (m.meta?.thinking as ThinkingMeta[] | undefined) ?? [];
                  const trace = [
                    ...thinking.filter((t) => t.text?.trim()).map((t) => thinkingToNode(t)),
                    ...calls.map((tc) => toolToNode(tc)),
                  ];
                  if (trace.length === 0) return null;
                  return <ThinkingState nodes={trace} autoPlay={false} />;
                })()}
                {m.content ? (
                  m.meta?.error ? (
                    <ChatMessage variant="assistant">
                      <p className="text-destructive">{m.content}</p>
                    </ChatMessage>
                  ) : (
                    <ChatMessage variant="assistant">
                      <Markdown text={m.content} />
                    </ChatMessage>
                  )
                ) : null}
              </>
            )}
          </ChatThreadRow>
        ))}

        {/* live run: thinking, tools, streaming text */}
        {chat.running || chat.toolEvents.length > 0 || chat.streamText ? (
          <ChatThreadRow>
            {chat.thinking || chat.toolEvents.length > 0 ? (
              <ThinkingState
                autoPlay={false}
                defaultExpanded
                workingLabel={chat.toolEvents.length > 0 ? "Working…" : "Thinking…"}
                nodes={[
                  ...(chat.thinking ? [thinkingToNode({ text: chat.thinking }, true)] : []),
                  ...chat.toolEvents.map((t) => liveToolToNode(t)),
                ]}
              />
            ) : null}
            {chat.streamText ? (
              <ChatMessage variant="assistant">
                <Markdown text={chat.streamText} />
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-ink align-middle" />
              </ChatMessage>
            ) : null}
            {chat.status ? <p className="px-1 text-[11px] text-ink-muted">{chat.status}</p> : null}
          </ChatThreadRow>
        ) : null}
      </ChatThread>

      <ChatFooter>
        {chat.error ? <ChatFooterNotice>{chat.error}</ChatFooterNotice> : null}
        {!connected ? <ChatReconnecting /> : null}
        <QueuePills items={chat.queue} onRemove={chat.removeQueued} onSendNow={chat.sendQueuedNow} />
        {chat.ask ? (
          <AskWidget questions={chat.ask.questions} onAnswer={(answers) => chat.answer(chat.ask!.askId, answers)} onCancel={() => chat.cancelAsk(chat.ask!.askId)} />
        ) : (
          <ChatComposer busy={chat.running}>
            <MentionPopup
              query={mentionQuery ?? "\u0000"}
              files={mentionQuery === null ? [] : files}
              activeIndex={mentionIndex}
              onPick={pickMention}
              onHover={setMentionIndex}
            />
            <AttachmentChips paths={attachments} onRemove={(p) => setAttachments((prev) => prev.filter((x) => x !== p))} />
            <ChatComposerInput
              value={draft}
              placeholder={detail ? `Message ${detail.title}…  (@ file, /new, /compact)` : "Message…"}
              onChange={(e) => {
                setDraft(e.target.value);
                setMentionIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && mentionMatches.length > 0) {
                  e.preventDefault();
                  setMentionIndex((i) => (i + 1) % mentionMatches.length);
                  return;
                }
                if (e.key === "ArrowUp" && mentionMatches.length > 0) {
                  e.preventDefault();
                  setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
                  return;
                }
                if (e.key === "Tab" && mentionQuery !== null && mentionMatches.length > 0) {
                  e.preventDefault();
                  pickMention(mentionIndex);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape" && chat.running) void chat.abort();
              }}
            />
            <ChatComposerActions>
              <ChatComposerSpacer />
              {chat.running ? <ChatComposerStop onClick={() => void chat.abort()} /> : null}
              <ChatComposerSend disabled={!draft.trim() && attachments.length === 0} aria-label={chat.running ? "Queue message" : "Send"} onClick={submit} />
            </ChatComposerActions>
          </ChatComposer>
        )}

        <ChatStatusBar>
          <ChatUsage>
            <ChatUsageStat title="Input tokens (incl. cached)">↑ {fmtTokens(chat.usage?.inputTokens ?? 0)}</ChatUsageStat>
            <ChatUsageStat title="Output tokens">↓ {fmtTokens(chat.usage?.outputTokens ?? 0)}</ChatUsageStat>
            <ChatUsageStat title="Cache hit — cached input / total input">⚡ {cacheHit}</ChatUsageStat>
            <ChatUsageContext
              percent={ctxPct}
              label={chat.usage ? `${fmtTokens(chat.usage.inputTokens)}${modelInfo?.contextWindow ? ` / ${fmtTokens(modelInfo.contextWindow)}` : ""}` : "context —"}
              title="Context consumed vs the model's context window"
              breakdown={[
                { label: "input", value: fmtTokens(chat.usage?.inputTokens ?? 0) },
                { label: "cached", value: fmtTokens(chat.usage?.cachedTokens ?? 0) },
                { label: "output", value: fmtTokens(chat.usage?.outputTokens ?? 0) },
                { label: "model calls", value: String(chat.usage?.calls ?? 0) },
              ]}
            />
            <ChatUsageSpacer />
            {providers.length > 0 && detail ? (
              <ModelPicker
                providers={providers}
                value={detail.model}
                thinkingLevel={detail.thinkingLevel ?? undefined}
                onChange={(id) => {
                  void fetch(`/artisan-api/sessions/${detail.id}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ model: id }),
                  }).then(() => chat.refresh());
                }}
                onThinkingChange={(level) => {
                  void fetch(`/artisan-api/sessions/${detail.id}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ thinkingLevel: level }),
                  }).then(() => chat.refresh());
                }}
              />
            ) : null}
          </ChatUsage>
          <div data-slot="chat-metrics" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-ink-muted">
            <ChatUsageStat title="Generation speed">Speed {tokPerSec !== null ? `${tokPerSec} tok/s` : "—"}</ChatUsageStat>
            <ChatUsageStat title="Session cost">Cost {chat.usage?.costUsd != null ? `$${chat.usage.costUsd.toFixed(4)}` : "—"}</ChatUsageStat>
          </div>
        </ChatStatusBar>
      </ChatFooter>
    </ChatShell>
  );
}
