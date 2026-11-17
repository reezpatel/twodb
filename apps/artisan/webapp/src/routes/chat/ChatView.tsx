import { TOGGLE_EXPAND_EVENT, announceExpandState } from "./hooks/useExpandToggle.js";
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
import { BUILTIN_COMMANDS, filterCommands, SlashPopup, useSlashCommands } from "./partials/SlashCommands.js";
import { useWorkspaceWs } from "../../lib/workspace-ws.js";
import { SquareDashed } from "lucide-react";
import { ChatComposer, ChatComposerRichInput, type InlineToken, ChatComposerActions, ChatComposerSpacer, ChatComposerSend, ChatComposerStop } from "./partials/ChatComposer.js";
import { ChatUsage, ChatUsageStat, ChatUsageContext, ChatUsageSpacer } from "./partials/ChatUsage.js";
import { ChatMessage } from "./partials/ChatMessage.js";
import { ChatProgress } from "./partials/ChatProgress.js";
import { AskWidget } from "./partials/AskWidget.js";
import { ModelPicker, type ModelProvider, type ModelEntry, type TraceNode } from "@twodb/blocks";
import { apiFetch } from "../../lib/artisan-client.js";

/** Legacy token formatting: 1.2k / 3.4M (never raw thousands). */
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Stable wrappers so the transcript map doesn't create new component types
 *  each render (which would remount blocks and drop their expansion state). */
const AssistantMarkdown = (p: { text: string }) => (
  <ChatMessage variant="assistant">
    <Markdown text={p.text} />
  </ChatMessage>
);
const AssistantError = (p: { text: string }) => (
  <ChatMessage variant="assistant">
    <p className="text-destructive">{p.text}</p>
  </ChatMessage>
);
const PersistedTrace = (p: { nodes: TraceNode[]; forceExpanded?: boolean }) => (
  <ThinkingState nodes={p.nodes} autoPlay={false} forceExpanded={p.forceExpanded} />
);

type ChatMsg = ReturnType<typeof useSessionChat>["messages"][number];
type LiveTool = ReturnType<typeof useSessionChat>["toolEvents"][number];
type ThreadItem =
  | { key: string; kind: "user"; m: ChatMsg }
  | { key: string; kind: "note"; m: ChatMsg }
  | { key: string; kind: "assistant"; trace: TraceNode[]; text: string; error: boolean };

/**
 * Persisted rounds are one message each. A round with tool calls but no text
 * would otherwise render its own "Worked" block; fold consecutive text-less
 * assistant rounds into one trace, closed out by the next message that has text
 * (or by a user/system message, or the end of the transcript).
 */
function groupThread(messages: ChatMsg[], live: Map<string, LiveTool>): ThreadItem[] {
  const items: ThreadItem[] = [];
  let pending: TraceNode[] = [];
  let pendingKey = "";
  const flush = () => {
    if (pending.length > 0) items.push({ key: `trace-${pendingKey}`, kind: "assistant", trace: pending, text: "", error: false });
    pending = [];
    pendingKey = "";
  };
  for (const m of messages) {
    if (m.role === "user") {
      flush();
      items.push({ key: m.id, kind: "user", m });
    } else if (m.role === "compaction" || m.role === "system") {
      flush();
      items.push({ key: m.id, kind: "note", m });
    } else {
      const calls = (m.meta?.toolCalls as ToolCallMeta[] | undefined) ?? [];
      const thinking = (m.meta?.thinking as ThinkingMeta[] | undefined) ?? [];
      const nodes: TraceNode[] = [
        ...thinking.filter((t) => t.text?.trim()).map((t, ti) => thinkingToNode({ ...t, id: `think-${m.id}-${ti}` })),
        // A tool still running is not finished in the saved row yet — show its live state in place.
        ...calls.map((tc) => {
          const ev = tc.output == null && tc.ok == null ? live.get(tc.id) : undefined;
          return ev ? liveToolToNode(ev) : toolToNode(tc);
        }),
      ];
      if (!pendingKey) pendingKey = m.id;
      pending.push(...nodes);
      if (m.content) {
        items.push({ key: m.id, kind: "assistant", trace: pending, text: m.content, error: !!m.meta?.error });
        pending = [];
        pendingKey = "";
      }
    }
  }
  flush();
  return items;
}

/** Context chars → tokens estimate → % of the model's window. */
function contextPercent(usage: { contextTokens?: number } | null, contextWindow: number | null): number | null {
  if (!usage?.contextTokens || !contextWindow) return null;
  return Math.min(100, Math.round((usage.contextTokens / contextWindow) * 100));
}

/**
 * Legacy-style chat: centered transcript (user = right-shifted tinted
 * bubble, assistant = open text), bordered composer with Stop/Send, and a
 * usage status bar (↑ ↓ ⚡ + context ring + model picker).
 */
export function ChatView(props: { sessionId: string; noHeader?: boolean; /** llm_chat: no runner — hides @files and the terminal shortcut. */ plain?: boolean }) {
  const chat = useSessionChat(props.sessionId);
  const { connected } = useWorkspaceWs();
  const catalog = useCatalog();
  const [draft, setDraft] = useState("");
  const [tokPerSec, setTokPerSec] = useState<number | null>(null);
  /** Cmd/Ctrl+O → 1 = expand all, 0 = collapse all, null = manual per-block. */
  const [expandAll, setExpandAll] = useState<null | 1 | 0>(null);

  const liveDeltaRef = useRef({ count: 0, startedAt: 0 });
  const [mentionIndex, setMentionIndex] = useState(0);
  const files = useDirectoryFiles(props.plain ? null : props.sessionId);
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
  const mentionMatches = mentionQuery === null ? [] : files.filter((f) => f.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8);

  // Trailing `/query` (null when not slashing) — but not when mentioning (@ wins).
  const slashQuery = (() => {
    if (mentionQuery !== null) return null;
    const m = /(?:^|\s)\/(\S*)$/.exec(draft);
    return m ? m[1] : null;
  })();
  const slashMatches =
    slashQuery === null
      ? []
      : filterCommands(slashCommands, slashQuery);

  // A picked mention stays in the text as `@path ` (highlighted) — the agent reads it from there.
  const pickMention = (index: number) => {
    const path = mentionMatches[index];
    if (!path) return;
    setDraft((d) => d.replace(/(^|\s)@\S*$/, `$1@${path} `));
    setMentionIndex(0);
  };

  // A picked command / skill stays in the text as `/name ` (highlighted); it takes effect on send.
  const pickSlash = (index: number) => {
    const item = slashMatches[index];
    if (!item) return;
    setDraft((d) => d.replace(/(^|\s)\/\S*$/, `$1/${item.label} `));
    setSlashIndex(0);
  };

  const commandNames = useMemo(() => new Set(BUILTIN_COMMANDS.map((c) => c.label)), []);
  const skillByName = useMemo(() => new Map(skills.map((s) => [s.name, s])), [skills]);
  const fileSet = useMemo(() => new Set(files), [files]);
  const tokens = useMemo<InlineToken[]>(
    () => [
      { test: (t) => t.startsWith("@") && fileSet.has(t.slice(1)), className: "bg-surface-muted ring-1 ring-outline" },
      { test: (t) => t.startsWith("/") && (commandNames.has(t.slice(1)) || skillByName.has(t.slice(1))), className: "bg-primary/15 ring-1 ring-primary/30" },
    ],
    [fileSet, commandNames, skillByName],
  );

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
    let text = draft.trim();
    // Built-in commands run instead of sending: `/compact`, `/clear`, `/new`.
    const cmd = /^\/(compact|clear|new)(?:\s|$)/.exec(text);
    if (cmd) {
      setDraft("");
      if (cmd[1] === "compact") void chat.compact();
      else if (cmd[1] === "clear") void chat.clearThread();
      else void chat.newThread();
      return;
    }
    // Skill tokens expand to <skill> blocks in the message, like the legacy composer.
    text = text.replace(/(^|\s)\/([\w][\w.-]*)/g, (m, lead: string, name: string) => {
      const skill = skillByName.get(name);
      return skill?.content ? `${lead}<skill name="${name}">\n${skill.content.slice(0, 20_000)}\n</skill>` : m;
    });
    if (!text && attachments.length === 0) return;
    // Resolve attachment bodies: uploaded files read from disk, skills from cached content.
    void (async () => {
      const blocks = await Promise.all(
        attachments.map(async (a) => {
          if (a.path.startsWith("skill:")) {
            return `--- ${a.path.slice(6)} (skill) ---\n${(skillContent[a.path] ?? "").slice(0, 20_000)}`;
          }
          const content = a.uploaded
            ? await apiFetch(`/files/read?path=${encodeURIComponent(a.path)}`)
                .then((r) => (r.ok ? r.json() : { content: "" }))
                .then((d: { content?: string }) => d.content ?? "")
                .catch(() => "")
            : await apiFetch(`/sessions/${props.sessionId}/files/${encodeURI(a.path)}`)
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

  // Tool calls already saved on a message render there (in order, with that round);
  // the live block only shows calls the transcript hasn't caught up with yet.
  const liveById = useMemo(() => new Map(chat.toolEvents.map((t) => [t.id, t])), [chat.toolEvents]);
  const savedToolIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of chat.messages) for (const tc of (m.meta?.toolCalls as ToolCallMeta[] | undefined) ?? []) ids.add(tc.id);
    return ids;
  }, [chat.messages]);
  const pendingTools = useMemo(() => chat.toolEvents.filter((t) => !savedToolIds.has(t.id)), [chat.toolEvents, savedToolIds]);

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

  // App-wide O / Cmd/Ctrl+O (wired in App.tsx) → toggle expand/collapse all thinking/tool blocks.
  useEffect(() => {
    const onToggle = () => setExpandAll((prev) => (prev === 1 ? 0 : 1));
    window.addEventListener(TOGGLE_EXPAND_EVENT, onToggle);
    return () => window.removeEventListener(TOGGLE_EXPAND_EVENT, onToggle);
  }, []);
  // Keep the header button's icon in sync.
  useEffect(() => {
    announceExpandState(expandAll === 1);
    return () => announceExpandState(false);
  }, [expandAll]);

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
          <ChatHeaderTitle title={detail?.title ?? props.sessionId.slice(-8)} sub={detail ? `${detail.runner}:${detail.directory}` : undefined} />
          {chat.running ? (
            <span className="ml-2 flex items-center gap-1.5 text-xs text-ink-muted">
              <span className="size-1.5 animate-pulse rounded-full bg-success" />
              running
            </span>
          ) : null}
          <ChatHeaderActions>
            <ChatHeaderAction icon={<Sparkles className="size-3.5" />} label="New thread (/new)" onClick={() => void chat.newThread()} />
            <ChatHeaderAction icon={<Scissors className="size-3.5" />} label="Compact context (/compact)" onClick={() => void chat.compact()} />
          </ChatHeaderActions>
        </ChatHeader>
      )}

      <ChatThread className="overflow-y-auto" ref={chat.scroller}>
        {groupThread(chat.messages, liveById).map((it) => (
          <ChatThreadRow key={it.key}>
            {it.kind === "user" ? (
              <ChatMessage variant="user">
                <Markdown text={it.m.content} />
              </ChatMessage>
            ) : it.kind === "note" ? (
              it.m.role === "compaction" ? (
                <div className="my-2 rounded-md border border-outline bg-surface-muted/40 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-muted">
                    <Scissors className="size-3" />
                    Context compacted — summary of the conversation so far
                  </div>
                  <div className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-[12px] text-ink-muted/90">{it.m.content}</div>
                </div>
              ) : (
                <ChatThreadHeader>
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="size-3" />
                    {it.m.content.slice(0, 240)}
                  </span>
                </ChatThreadHeader>
              )
            ) : (
              <>
                {it.trace.length > 0 ? <PersistedTrace nodes={it.trace} forceExpanded={expandAll === null ? undefined : expandAll === 1} /> : null}
                {it.text ? it.error ? <AssistantError text={it.text} /> : <AssistantMarkdown text={it.text} /> : null}
              </>
            )}
          </ChatThreadRow>
        ))}

        {/* live run: thinking, tools, streaming text */}
        {chat.running || chat.compacting || pendingTools.length > 0 || chat.streamText ? (
          <ChatThreadRow>
            {chat.compacting ? <ChatProgress>compacting context…</ChatProgress> : null}
            {chat.thinking || pendingTools.length > 0 ? (
              <ThinkingState
                autoPlay={false}
                defaultExpanded
                forceExpanded={expandAll === null ? undefined : expandAll === 1}
                workingLabel={pendingTools.length > 0 ? "Working…" : "Thinking…"}
                nodes={[...(chat.thinking ? [thinkingToNode({ text: chat.thinking }, true)] : []), ...pendingTools.map((t) => liveToolToNode(t))]}
              />
            ) : null}
            {chat.streamText ? (
              <ChatMessage variant="assistant">
                <Markdown text={chat.streamText} />
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-ink align-middle" />
              </ChatMessage>
            ) : null}
            {chat.running && !chat.compacting && !chat.streamText ? <ChatProgress look={{ state: "reasoning" }}>thinking</ChatProgress> : null}
            {chat.status && !chat.compacting ? <ChatProgress look={{}}>{chat.status}</ChatProgress> : null}
          </ChatThreadRow>
        ) : null}
      </ChatThread>

      <ChatFooter>
        {chat.error ? <ChatFooterNotice>{chat.error}</ChatFooterNotice> : null}
        {!connected ? <ChatReconnecting /> : null}
        <QueuePills items={chat.queue} onRemove={chat.removeQueued} onSendNow={chat.sendQueuedNow} />
        {chat.ask ? (
          <AskWidget
            questions={chat.ask.questions}
            onAnswer={(answers) => chat.answer(chat.ask!.askId, answers)}
            onCancel={() => chat.cancelAsk(chat.ask!.askId)}
          />
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
            <ChatComposerRichInput
              tokens={tokens}
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
              <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => void onPickFiles(e.target.files)} />
              <button
                type="button"
                data-slot="chat-attach"
                aria-label="Attach files"
                title="Attach files"
                disabled={uploading}
                className="flex size-7 md:size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-40"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-3.5 md:size-4" />
              </button>
              <ChatComposerSpacer />
              {chat.running ? <ChatComposerStop onClick={() => void chat.abort()} /> : null}
              <ChatComposerSend disabled={!draft.trim() && attachments.length === 0} aria-label={chat.running ? "Queue message" : "Send"} onClick={submit} />
            </ChatComposerActions>
          </ChatComposer>
        )}

        <ChatStatusBar>
          <ChatUsage>
            <ChatUsageStat className="hidden md:inline" title="Input tokens (incl. cached)">↑ {fmtTokens(chat.usage?.inputTokens ?? 0)}</ChatUsageStat>
            <ChatUsageStat className="hidden md:inline" title="Output tokens">↓ {fmtTokens(chat.usage?.outputTokens ?? 0)}</ChatUsageStat>
            <ChatUsageStat className="hidden md:inline" title="Cache hit — cached input / total input">⚡ {cacheHit}</ChatUsageStat>
            <ChatUsageContext
              percent={ctxPct}
              label={
                chat.usage?.contextTokens ? `${fmtTokens(chat.usage.contextTokens)}${modelInfo?.contextWindow ? ` / ${fmtTokens(modelInfo.contextWindow)}` : ""}` : "context —"
              }
              title="Size of the latest request vs the model's context window"
              breakdown={[
                { label: "in context now", value: fmtTokens(chat.usage?.contextTokens ?? 0) },
                { label: "input (total)", value: fmtTokens(chat.usage?.inputTokens ?? 0) },
                { label: "cached", value: fmtTokens(chat.usage?.cachedTokens ?? 0) },
                { label: "output", value: fmtTokens(chat.usage?.outputTokens ?? 0) },
                { label: "model calls", value: String(chat.usage?.calls ?? 0) },
                { label: "cache hit", value: cacheHit },
                { label: "speed", value: tokPerSec !== null ? `${tokPerSec} tok/s` : "—" },
                { label: "cost", value: chat.usage?.costUsd != null ? `$${chat.usage.costUsd.toFixed(4)}` : "—" },
              ]}
            />
            <ChatUsageSpacer />
            {props.plain ? null : <button
              type="button"
              data-slot="terminal-toggle"
              title="Open terminal"
              className="hidden size-6 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink md:flex"
              onClick={() => window.dispatchEvent(new CustomEvent("artisan:open-tab", { detail: "terminal" }))}
            >
              <SquareDashed className="size-3.5" />
            </button>}
            {providers.length > 0 && detail ? (
              <ModelPicker
                providers={providers}
                value={detail.model}
                thinkingLevel={detail.thinkingLevel ?? undefined}
                onChange={(id) => {
                  void apiFetch(`/sessions/${detail.id}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ model: id }),
                  }).then(() => chat.refresh());
                }}
                onThinkingChange={(level) => {
                  void apiFetch(`/sessions/${detail.id}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ thinkingLevel: level }),
                  }).then(() => chat.refresh());
                }}
              />
            ) : null}
          </ChatUsage>
          <div data-slot="chat-metrics" className="hidden flex-wrap items-center md:flex gap-x-4 gap-y-1 px-1 text-sm text-ink-muted">
            <ChatUsageStat title="Generation speed">Speed {tokPerSec !== null ? `${tokPerSec} tok/s` : "—"}</ChatUsageStat>
            <ChatUsageStat title="Session cost">Cost {chat.usage?.costUsd != null ? `$${chat.usage.costUsd.toFixed(4)}` : "—"}</ChatUsageStat>
          </div>
        </ChatStatusBar>
      </ChatFooter>
    </ChatShell>
  );
}
