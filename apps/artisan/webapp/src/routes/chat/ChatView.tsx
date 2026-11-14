import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Scissors, Paperclip } from "lucide-react";
import { Markdown, ThinkingState } from "@twodb/blocks";
import { toolToNode, thinkingToNode, liveToolToNode, type ToolCallMeta, type ThinkingMeta } from "./trace.js";
import { useSessionChat } from "./hooks/useSessionChat.js";
import { useCatalog } from "../shell/hooks/useCatalog.js";
import { ChatShell, ChatThread, ChatThreadRow, ChatThreadHeader } from "./partials/ChatShell.js";
import { ChatHeader, ChatHeaderTitle, ChatHeaderStatus, ChatHeaderActions, ChatHeaderAction } from "./partials/ChatHeader.js";
import { ChatFooter, ChatFooterNotice, ChatReconnecting, ChatStatusBar } from "./partials/ChatFooter.js";
import { AttachmentChips, MentionPopup, QueuePills } from "./partials/ChatAttachments.js";
import { useDirectoryFiles, useSkills, uploadAttachment } from "./hooks/useDirectoryFiles.js";
import { SlashPopup, useSlashCommands } from "./partials/SlashCommands.js";
import { useWorkspaceWs } from "../../lib/workspace-ws.js";
import { SquareDashed } from "lucide-react";
import { ChatComposer, ChatComposerInput, ChatComposerActions, ChatComposerSpacer, ChatComposerSend, ChatComposerStop } from "./partials/ChatComposer.js";
import { ChatUsage, ChatUsageStat, ChatUsageContext, ChatUsageSpacer } from "./partials/ChatUsage.js";
import { ChatMessage } from "./partials/ChatMessage.js";
import { AskWidget } from "./partials/AskWidget.js";
import { ModelPicker, type ModelProvider, type ModelEntry, type TraceNode } from "@twodb/blocks";

/** Legacy token formatting: 1.2k / 3.4M (never raw thousands). */
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Stable wrappers so the transcript map doesn't create new component types
 *  each render (which would remount blocks and drop their expansion state). */
const AssistantMarkdown = (p: { text: string }) => (
  <ChatMessage variant="assistant"><Markdown text={p.text} /></ChatMessage>
);
const AssistantError = (p: { text: string }) => (
  <ChatMessage variant="assistant"><p className="text-destructive">{p.text}</p></ChatMessage>
);
const PersistedTrace = (p: { nodes: TraceNode[]; forceExpanded?: boolean }) => (
  <ThinkingState nodes={p.nodes} autoPlay={false} forceExpanded={p.forceExpanded} />
);

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
  const [tokPerSec, setTokPerSec] = useState<number | null>(null);
  /** Cmd/Ctrl+0 → 1 = expand all, 0 = collapse all, null = manual per-block. */
  const [expandAll, setExpandAll] = useState<null | 1 | 0>(null);

  const liveDeltaRef = useRef({ count: 0, startedAt: 0 });
  const [mentionIndex, setMentionIndex] = useState(0);
  const files = useDirectoryFiles(props.sessionId);
  const detail = chat.detail;
  const [attachments, setAttachments] = useState<Array<{ path: string; uploaded?: boolean; name?: string }>>([]);
  const [skillContent, setSkillContent] = useState<Record<string, string>>({});
  const [slashIndex, setSlashIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skills = useSkills(detail?.spaceId);
  const slashCommands = useSlashCommands(skills);

  useEffect(() => {
    setDraft("");
    setAttachments([]);
    setSkillContent({});
  }, [props.sessionId]);

  // Trailing `@query` (null when the composer isn't mentioning).
  const mentionQuery = (() => {
    const m = /(?:^|\s)@(\S*)$/.exec(draft);
    return m ? m[1] : null;
  })();
  const mentionMatches = mentionQuery === null
    ? []
    : files.filter((f) => f.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8);

  // Trailing `/query` (null when not slashing) — but not when mentioning (@ wins).
  const slashQuery = (() => {
    if (mentionQuery !== null) return null;
    const m = /(?:^|\s)\/(\S*)$/.exec(draft);
    return m ? m[1] : null;
  })();
  const slashMatches = slashQuery === null
    ? []
    : slashCommands.filter((c) => !slashQuery || c.label.toLowerCase().includes(slashQuery.toLowerCase()) || c.description.toLowerCase().includes(slashQuery.toLowerCase())).slice(0, 9);

  const pickMention = (index: number) => {
    const path = mentionMatches[index];
    if (!path) return;
    setDraft((d) => d.replace(/(?:^|\s)@\S*$/, " ").replace(/\s+$/, " "));
    setAttachments((prev) => (prev.some((a) => a.path === path) ? prev : [...prev, { path }]));
    setMentionIndex(0);
  };

  const pickSlash = (index: number) => {
    const item = slashMatches[index];
    if (!item) return;
    setDraft((d) => d.replace(/(?:^|\s)\/\S*$/, " ").replace(/\s+$/, " "));
    setSlashIndex(0);
    if (item.id === "cmd:compact") void chat.compact();
    else if (item.id === "cmd:clear") void chat.clearThread();
    else if (item.id === "cmd:new") void chat.newThread();
    else if (item.content) {
      // skill: attach as a fenced block on send
      setAttachments((prev) => [...prev, { path: `skill:${item.label}`, uploaded: true, name: `${item.label} (skill)` }]);
      setSkillContent((prev) => ({ ...prev, [`skill:${item.label}`]: item.content ?? "" }));
    }
  };

  const onPickFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const path = await uploadAttachment(props.sessionId, file);
        setAttachments((prev) => [...prev, { path, uploaded: true, name: file.name }]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submit = () => {
    if (mentionQuery !== null && mentionMatches.length > 0) {
      pickMention(mentionIndex);
      return;
    }
    if (slashQuery !== null && slashMatches.length > 0) {
      pickSlash(slashIndex);
      return;
    }
    const text = draft.trim();
    if (!text && attachments.length === 0) return;
    // Resolve attachment bodies: uploaded files read from disk, skills from cached content.
    void (async () => {
      const blocks = await Promise.all(
        attachments.map(async (a) => {
          if (a.path.startsWith("skill:")) {
            return `--- ${a.path.slice(6)} (skill) ---\n${(skillContent[a.path] ?? "").slice(0, 20_000)}`;
          }
          const content = a.uploaded
            ? await fetch(`/artisan-api/files/read?path=${encodeURIComponent(a.path)}`, { credentials: "include" })
                .then((r) => (r.ok ? r.json() : { content: "" }))
                .then((d: { content?: string }) => d.content ?? "")
                .catch(() => "")
            : await fetch(`/artisan-api/sessions/${props.sessionId}/files/${encodeURI(a.path)}`, { credentials: "include" })
                .then((r) => (r.ok ? r.json() : { content: "" }))
                .then((d: { content?: string }) => d.content ?? "")
                .catch(() => "");
          return `--- ${a.uploaded ? a.name : a.path} ---\n${content.slice(0, 20_000)}`;
        }),
      );
      const body = blocks.length ? `${text}\n\n${blocks.join("\n\n")}` : text;
      setDraft("");
      setAttachments([]);
      setSkillContent({});
      void chat.send(body);
    })();
  };

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

  // App-wide Cmd/Ctrl+0 (wired in App.tsx) → toggle expand/collapse all thinking/tool blocks.
  useEffect(() => {
    const onToggle = () => setExpandAll((prev) => (prev === 1 ? 0 : 1));
    window.addEventListener("artisan:toggle-expand", onToggle);
    return () => window.removeEventListener("artisan:toggle-expand", onToggle);
  }, []);

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
                  const trace: TraceNode[] = [
                    ...thinking.filter((t) => t.text?.trim()).map((t, ti) => thinkingToNode({ ...t, id: `think-${m.id}-${ti}` })),
                    ...calls.map((tc) => toolToNode(tc)),
                  ];
                  if (trace.length === 0) return null;
                  return <PersistedTrace nodes={trace} forceExpanded={expandAll === null ? undefined : expandAll === 1} />;
                })()}
                {m.content ? (
                  m.meta?.error ? <AssistantError text={m.content} /> : <AssistantMarkdown text={m.content} />
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
                forceExpanded={expandAll === null ? undefined : expandAll === 1}
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
            <SlashPopup
              query={slashQuery ?? ""}
              items={slashQuery === null ? [] : slashCommands}
              activeIndex={slashIndex}
              onPick={pickSlash}
              onHover={setSlashIndex}
            />
            <AttachmentChips items={attachments} onRemove={(p) => setAttachments((prev) => prev.filter((x) => x.path !== p))} />
            <ChatComposerInput
              value={draft}
              placeholder={detail ? `Message ${detail.title}…  (@ file, / command)` : "Message…"}
              onChange={(e) => {
                setDraft(e.target.value);
                setMentionIndex(0);
                setSlashIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && slashMatches.length > 0) {
                  e.preventDefault();
                  setSlashIndex((i) => (i + 1) % slashMatches.length);
                  return;
                }
                if (e.key === "ArrowUp" && slashMatches.length > 0) {
                  e.preventDefault();
                  setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length);
                  return;
                }
                if ((e.key === "Tab" || e.key === "Enter") && slashQuery !== null && slashMatches.length > 0 && !e.shiftKey) {
                  e.preventDefault();
                  pickSlash(slashIndex);
                  return;
                }
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
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => void onPickFiles(e.target.files)}
              />
              <button
                type="button"
                data-slot="chat-attach"
                aria-label="Attach files"
                title="Attach files"
                disabled={uploading}
                className="flex size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-40"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
              </button>
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
            <button
              type="button"
              data-slot="terminal-toggle"
              title="Open terminal"
              className="flex size-6 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              onClick={() => window.dispatchEvent(new CustomEvent("artisan:open-tab", { detail: "terminal" }))}
            >
              <SquareDashed className="size-3.5" />
            </button>
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
