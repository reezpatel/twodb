import { useEffect, useMemo, useState } from "react";
import { Sparkles, Scissors } from "lucide-react";
import { Markdown } from "@twodb/blocks";
import { useSessionChat } from "./hooks/useSessionChat.js";
import { useCatalog } from "../shell/hooks/useCatalog.js";
import { ChatShell, ChatThread, ChatThreadRow, ChatThreadHeader } from "./partials/ChatShell.js";
import { ChatHeader, ChatHeaderTitle, ChatHeaderStatus, ChatHeaderActions, ChatHeaderAction } from "./partials/ChatHeader.js";
import { ChatFooter, ChatFooterNotice, ChatStatusBar } from "./partials/ChatFooter.js";
import { ChatComposer, ChatComposerInput, ChatComposerActions, ChatComposerSpacer, ChatComposerSend, ChatComposerStop } from "./partials/ChatComposer.js";
import { ChatUsage, ChatUsageStat, ChatUsageContext, ChatUsageSpacer } from "./partials/ChatUsage.js";
import { ChatMessage, ChatMessageNote } from "./partials/ChatMessage.js";
import { ToolCard } from "./partials/ToolCard.js";
import { AskWidget } from "./partials/AskWidget.js";
import { ModelPicker, type ModelProvider, type ModelEntry } from "@twodb/blocks";

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
export function ChatView(props: { sessionId: string }) {
  const chat = useSessionChat(props.sessionId);
  const catalog = useCatalog();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft("");
  }, [props.sessionId]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (chat.running) return; // Stop is the running-state action
    if (text === "/new") void chat.newThread();
    else if (text === "/compact") void chat.compact();
    else void chat.send(text);
  };

  const detail = chat.detail;
  const plan = detail?.plan ?? null;

  // Group models into providers for the picker.
  const providers = useMemo<ModelProvider[]>(() => {
    const byConn = new Map<string, ModelEntry[]>();
    for (const m of catalog.models) {
      const list = byConn.get(m.connection) ?? [];
      list.push({ id: m.id, label: m.name, context: m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k` : undefined });
      byConn.set(m.connection, list);
    }
    return [...byConn.entries()].map(([name, models]) => ({ id: name, title: name, models }));
  }, [catalog.models]);

  const modelInfo = catalog.models.find((m) => m.id === detail?.model);
  const ctxPct = contextPercent(chat.usage, modelInfo?.contextWindow ?? null);

  return (
    <ChatShell>
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
                {(m.meta?.toolCalls as Array<{ name: string }> | undefined)?.length ? (
                  <ChatMessageNote>tools: {((m.meta?.toolCalls as Array<{ name: string }>) ?? []).map((t) => t.name).join(", ")}</ChatMessageNote>
                ) : null}
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
            {chat.thinking ? (
              <details className="text-[11px] text-ink-muted">
                <summary className="cursor-pointer select-none">thinking…</summary>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{chat.thinking}</pre>
              </details>
            ) : null}
            {chat.toolEvents.map((t) => (
              <ToolCard key={t.id} event={t} />
            ))}
            {chat.streamText ? (
              <ChatMessage variant="assistant">
                <span className="whitespace-pre-wrap text-sm">{chat.streamText}</span>
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-ink align-middle" />
              </ChatMessage>
            ) : null}
            {chat.status ? <p className="px-1 text-[11px] text-ink-muted">{chat.status}</p> : null}
          </ChatThreadRow>
        ) : null}
      </ChatThread>

      <ChatFooter>
        {chat.error ? <ChatFooterNotice>{chat.error}</ChatFooterNotice> : null}
        {chat.ask ? (
          <AskWidget questions={chat.ask.questions} onAnswer={(answers) => chat.answer(chat.ask!.askId, answers)} onCancel={() => chat.cancelAsk(chat.ask!.askId)} />
        ) : (
          <ChatComposer busy={chat.running}>
            <ChatComposerInput
              value={draft}
              placeholder={detail ? `Message ${detail.title}…  (/new, /compact)` : "Message…"}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
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
              <ChatComposerSend disabled={!draft.trim() || chat.running} aria-label="Send" onClick={submit} />
            </ChatComposerActions>
          </ChatComposer>
        )}

        <ChatStatusBar>
          <ChatUsage>
            {chat.usage ? (
              <>
                <ChatUsageStat title="Input tokens (incl. cached)">↑ {(chat.usage.inputTokens + chat.usage.cachedTokens).toLocaleString()}</ChatUsageStat>
                <ChatUsageStat title="Output tokens">↓ {chat.usage.outputTokens.toLocaleString()}</ChatUsageStat>
                {chat.usage.cachedTokens ? (
                  <ChatUsageStat title="Cached input tokens">⚡ {chat.usage.cachedTokens.toLocaleString()}</ChatUsageStat>
                ) : null}
                <ChatUsageStat title="Model calls">{chat.usage.calls} calls</ChatUsageStat>
                <ChatUsageContext percent={ctxPct} label={ctxPct === null ? "context ?" : `${ctxPct}%`} />
              </>
            ) : (
              <ChatUsageStat>no usage yet</ChatUsageStat>
            )}
            <ChatUsageSpacer />
            {providers.length > 0 && detail ? (
              <ModelPicker
                providers={providers}
                value={detail.model}
                onChange={(id) => {
                  void fetch(`/artisan-api/sessions/${detail.id}`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ model: id }),
                  }).then(() => chat.refresh());
                }}
              />
            ) : null}
          </ChatUsage>
        </ChatStatusBar>
      </ChatFooter>
    </ChatShell>
  );
}
