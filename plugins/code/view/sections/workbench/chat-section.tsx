import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, AtSign, Code2, FolderOpen, GitCommitHorizontal, Loader2, Paperclip, Terminal, Wrench } from "lucide-react";
import { IconButton } from "@twodb/ui";
import type { CodeSessionEvent } from "../../../shared/api";
import type { LlmConnectionOption, LlmProviderCatalog } from "../../lib/api";
import { Markdown } from "./markdown/markdown";
import { ModelPickerDialog } from "./model-picker-dialog";
import { TerminalScreen } from "./screens/terminal-screen";
import { ChangesScreen } from "./screens/changes-screen";
import { chatSectionStyles } from "./chat-section.style";

type ScreenId = "chat" | "terminal" | "changes";

const TOP_TOOLS: Array<{ id: ScreenId; label: string; icon: typeof Code2 }> = [
  { id: "chat", label: "Chat", icon: Code2 },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "changes", label: "Changes", icon: GitCommitHorizontal },
];

const toolSummary = (name: string, args: string): string => {
  try {
    const parsed = JSON.parse(args || "{}") as Record<string, unknown>;
    if (typeof parsed.command === "string") return parsed.command;
    if (typeof parsed.path === "string") return parsed.path;
  } catch {
    return args.slice(0, 80);
  }
  return "";
};

function ToolCard({ name, summary, output, ok, running }: { name: string; summary: string; output: string | null; ok: boolean; running: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="code-chat__tool-group">
      <div className={`code-chat__tool-call${ok ? "" : " is-error"}`}>
        {running ? <Loader2 size={12} aria-hidden="true" className="code-chat__spin" /> : <Wrench size={12} aria-hidden="true" />}
        <span className="code-chat__tool-call-text">
          {name}
          {summary ? ` · ${summary}` : ""}
        </span>
        {output ? (
          <button type="button" className="code-chat__tool-expand" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "hide" : "output"}
          </button>
        ) : null}
      </div>
      {expanded && output ? <pre className="code-chat__tool-output">{output}</pre> : null}
    </div>
  );
}

const formatTokens = (value: number): string => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value));

function EventRow({ event, pendingTools }: { event: CodeSessionEvent; pendingTools: Map<string, { name: string; summary: string }> }) {
  switch (event.type) {
    case "assistant_delta":
      return null;
    case "usage":
      return null;
    case "user_message":
      return (
        <div className="code-chat__message code-chat__message--user">
          <span className="code-chat__role">You</span>
          <p className="code-chat__text">{event.text}</p>
        </div>
      );
    case "assistant_message":
      return (
        <div className="code-chat__message code-chat__message--agent">
          <span className="code-chat__role">Agent</span>
          <Markdown>{event.text || "(no content)"}</Markdown>
        </div>
      );
    case "tool_call":
      return <ToolCard name={event.name} summary={toolSummary(event.name, event.args)} output={null} ok pending />;
    case "tool_result": {
      pendingTools.delete(event.call_id);
      return <ToolCard name={event.name} summary={""} output={event.output || "(no output)"} ok={event.ok} pending={false} />;
    }
    case "error":
      return <p className="code-chat__error">{event.error}</p>;
    case "run_started":
      return <div className="code-chat__run-marker">— run started —</div>;
    case "run_finished":
      return <div className="code-chat__run-marker">— {event.reason === "completed" ? "finished" : event.reason} —</div>;
    default:
      return null;
  }
}

export function ChatSection({
  sessionId,
  events,
  running,
  send,
  sessionTitle,
  sessionFolder,
  connections,
  connectionId,
  onConnectionChange,
  model,
  onModelChange,
  providers,
}: {
  sessionId: string | null;
  events: CodeSessionEvent[];
  running: boolean;
  send: (message: string) => void;
  sessionTitle: string;
  sessionFolder: string;
  connections: LlmConnectionOption[];
  connectionId: string | null;
  onConnectionChange: (connectionId: string | null) => void;
  model: string | null;
  onModelChange: (model: string | null) => void;
  providers: LlmProviderCatalog[];
}) {
  const [screen, setScreen] = useState<ScreenId>("chat");
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const pendingTools = useMemo(() => {
    const pending = new Map<string, { name: string; summary: string }>();
    for (const event of events) {
      if (event.type === "tool_call") pending.set(event.call_id, { name: event.name, summary: toolSummary(event.name, event.args) });
      if (event.type === "tool_result") pending.delete(event.call_id);
    }
    return pending;
  }, [events]);

  const usageStats = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let lastInput = 0;
    let speed: number | null = null;
    let turns = 0;
    for (const event of events) {
      if (event.type === "usage") {
        inputTokens += event.input_tokens;
        outputTokens += event.output_tokens;
        lastInput = event.input_tokens;
        if (event.tokens_per_second != null) speed = event.tokens_per_second;
      }
      if (event.type === "run_started") turns += 1;
    }
    return { inputTokens, outputTokens, lastInput, speed, turns };
  }, [events]);

  const activeConnection = connections.find((connection) => connection.id === connectionId) ?? null;
  const activeProvider = providers.find((provider) => provider.id === activeConnection?.provider) ?? null;

  const liveRuns = useMemo(() => {
    const deltas = new Map<string, string>();
    const closed = new Set<string>();
    for (const event of events) {
      if (event.type === "assistant_delta") {
        deltas.set(event.run_id, (deltas.get(event.run_id) ?? "") + event.text);
      } else if (event.type === "assistant_message" || event.type === "run_finished") {
        closed.add(event.run_id);
      }
    }
    return [...deltas.entries()].filter(([runId]) => !closed.has(runId));
  }, [events]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length, pendingTools.size, liveRuns.length]);

  const sendDraft = () => {
    const text = draft.trim();
    if (!text || running) return;
    send(text);
    setDraft("");
  };

  return (
    <main className="code-chat">
      <style jsx>{chatSectionStyles}</style>

      <div className="code-chat__tools">
        {TOP_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`code-chat__tool${screen === tool.id ? " is-active" : ""}`}
            onClick={() => setScreen(tool.id)}
          >
            <tool.icon size={14} aria-hidden="true" />
            {tool.label}
          </button>
        ))}
      </div>

      {screen === "terminal" ? <TerminalScreen events={events} /> : null}
      {screen === "changes" ? <ChangesScreen events={events} /> : null}

      {screen === "chat" ? (
        !sessionId ? (
          <div className="code-chat__messages">
            <p className="code-chat__empty">Select a session on the left, or start a new one with +.</p>
          </div>
        ) : (
          <>
            <div className="code-chat__messages" ref={scrollRef}>
              {events.length === 0 && liveRuns.length === 0 ? (
                <p className="code-chat__empty">No messages yet — say something to kick the agent off on “{sessionTitle}”.</p>
              ) : (
                <>
                  {events.map((event, index) => (
                    <EventRow key={index} event={event} pendingTools={pendingTools} />
                  ))}
                  {liveRuns.map(([runId, text]) => (
                    <div key={`live-${runId}`} className="code-chat__message code-chat__message--agent">
                      <span className="code-chat__role">Agent</span>
                      <Markdown>{text}</Markdown>
                      <span className="code-chat__cursor" />
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="code-chat__composer">
              <textarea
                className="code-chat__input"
                rows={2}
                placeholder={running ? "Agent is running…" : "Ask the agent… (⌘⏎ to send)"}
                value={draft}
                disabled={running}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    sendDraft();
                  }
                }}
              />
              <div className="code-chat__composer-bar">
                <IconButton label="Attach" icon={<Paperclip size={15} />} />
                <IconButton label="Mention" icon={<AtSign size={15} />} />
                <span className="code-chat__composer-spacer" />
                <IconButton label="Send" icon={<ArrowUp size={15} />} variant="secondary" onClick={sendDraft} />
              </div>
            </div>

            <div className="code-chat__info">
              <button
                type="button"
                className="code-chat__info-item code-chat__info-item--button"
                onClick={() => setPickerOpen(true)}
              >
                {activeConnection
                  ? `${activeConnection.name}${model ? ` · ${model}` : ""}`
                  : model
                    ? `workspace default · ${model}`
                    : "workspace default model"}
              </button>
              <span className="code-chat__info-item code-chat__info-item--file">
                <FolderOpen size={12} aria-hidden="true" />
                {sessionFolder || "—"}
              </span>
              <span className="code-chat__info-item">
                <span className="code-chat__info-label">tokens</span>
                {usageStats.inputTokens > 0 || usageStats.outputTokens > 0
                  ? `↑ ${formatTokens(usageStats.inputTokens)} · ↓ ${formatTokens(usageStats.outputTokens)}`
                  : "—"}
              </span>
              <span className="code-chat__info-item">
                <span className="code-chat__info-label">ctx</span>
                {usageStats.lastInput > 0 ? formatTokens(usageStats.lastInput) : "—"}
              </span>
              <span className="code-chat__info-item">
                <span className="code-chat__info-label">speed</span>
                {usageStats.speed != null ? `${usageStats.speed} tok/s` : "—"}
              </span>
              <span className="code-chat__info-item">
                <span className="code-chat__info-label">runs</span>
                {usageStats.turns}
              </span>
            </div>
          </>
        )
      ) : null}

      <ModelPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        connections={connections}
        connectionId={connectionId}
        onPick={onConnectionChange}
        model={model}
        onPickModel={onModelChange}
        models={activeProvider?.models ?? []}
      />
    </main>
  );
}
