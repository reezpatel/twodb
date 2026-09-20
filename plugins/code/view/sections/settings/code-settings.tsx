import { useEffect, useRef, useState } from "react";
import { Badge, Button, EmptyState, Input, Select } from "@twodb/ui";
import type { CodeSession, CodeSessionEvent, StoredMessage } from "../../../shared/api";
import { nodeRepo } from "../../lib/api";
import { useCodeData, useSessionStream } from "../../hooks/use-code-data";

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  maxWidth: 960,
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 20,
  border: "1px solid var(--line)",
  borderRadius: "var(--r-lg)",
  background: "var(--surface)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 12,
};

const monoStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "var(--text-sm)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  margin: 0,
  padding: 12,
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-md)",
  maxHeight: 320,
  overflowY: "auto",
};

function NewSession({ onDone }: { onDone: () => void }) {
  const { createSession } = useCodeData();
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [nodeId, setNodeId] = useState("");

  const nodesQuery = nodeRepoListNodes();

  useEffect(() => {
    if (!nodeId && nodesQuery.data?.nodes[0]) setNodeId(nodesQuery.data.nodes[0].id);
  }, [nodesQuery.data, nodeId]);

  const online = nodesQuery.data?.nodes.filter((node) => node.status === "online") ?? [];

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: 0, color: "var(--ink)" }}>New session</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Input placeholder="Title — e.g. fix login bug" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Select
          options={[
            { value: "", label: online.length === 0 ? "No online machines" : "Select machine" },
            ...online.map((node) => ({ value: node.id, label: node.name })),
          ]}
          value={nodeId}
          onValueChange={(value) => setNodeId(value)}
        />
        <Input placeholder="Folder on machine — e.g. ~/projects/app" value={folder} onChange={(event) => setFolder(event.target.value)} />
        <Button
          disabled={title.trim().length === 0 || folder.trim().length === 0 || nodeId === "" || createSession.isPending}
          onClick={() => createSession.mutate({ title: title.trim(), node_id: nodeId, folder: folder.trim() }, { onSuccess: onDone })}
        >
          {createSession.isPending ? "Creating…" : "Create"}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function nodeRepoListNodes() {
  const [state, setState] = useState<{ data: { nodes: Array<{ id: string; name: string; status: string }> } | null }>({ data: null });
  useEffect(() => {
    let active = true;
    void nodeRepo.listNodes().then(
      (data) => {
        if (active) setState({ data });
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, []);
  return state;
}

function EventRow({ event }: { event: CodeSessionEvent }) {
  const at = new Date(event.at).toLocaleTimeString();
  switch (event.type) {
    case "run_started":
      return <span style={{ color: "var(--ink-3)" }}>— run started ({at}) —</span>;
    case "user_message":
      return (
        <span>
          <strong style={{ color: "var(--ink)" }}>you:</strong> {event.text}
        </span>
      );
    case "tool_call":
      return (
        <span style={{ color: "var(--ink-2)" }}>
          ⚙ {event.name} <code>{event.args.slice(0, 160)}</code>
        </span>
      );
    case "tool_result":
      return (
        <span style={{ color: event.ok ? "var(--ink-2)" : "var(--danger-ink)" }}>
          ↳ {event.ok ? "" : "FAILED "}
          <code>{event.output.slice(0, 240)}</code>
        </span>
      );
    case "assistant_message":
      return (
        <span>
          <strong style={{ color: "var(--ink)" }}>agent:</strong> {event.text}
        </span>
      );
    case "run_finished":
      return (
        <span style={{ color: "var(--ink-3)" }}>
          — finished: {event.reason} ({at}) —
        </span>
      );
    case "error":
      return <span style={{ color: "var(--danger-ink)" }}>error: {event.error}</span>;
    default:
      return null;
  }
}

const contentText = (content: StoredMessage["content"]): string =>
  typeof content === "string" ? content : content == null ? "" : content.map((part) => ("text" in part ? part.text : `[${part.type}]`)).join("");

function HistoryBlock({ messages }: { messages: StoredMessage[] }) {
  if (messages.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <span key={message.id} style={{ fontSize: "var(--text-sm)" }}>
              <strong>you:</strong> {contentText(message.content)}
            </span>
          );
        }
        if (message.role === "assistant" && message.content) {
          return (
            <span key={message.id} style={{ fontSize: "var(--text-sm)" }}>
              <strong>agent:</strong> {contentText(message.content)}
            </span>
          );
        }
        if (message.role === "tool") {
          return (
            <span key={message.id} style={{ fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
              ⚙ {message.name}: {String(message.content ?? "").slice(0, 120)}
            </span>
          );
        }
        return null;
      })}
    </div>
  );
}

function SessionDetail({ session }: { session: CodeSession }) {
  const { removeSession, useSessionDetail } = useCodeData();
  const detail = useSessionDetail(session.id);
  const stream = useSessionStream(session.id);
  const [input, setInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [stream.events]);

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, color: "var(--ink)" }}>
          {session.title} <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· {session.folder}</span>
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {stream.running ? <Badge>running</Badge> : null}
          {confirmDelete ? (
            <>
              <Button variant="danger" onClick={() => removeSession.mutate(session.id)}>
                Confirm delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {detail.data ? <HistoryBlock messages={detail.data.messages} /> : null}

      <div ref={logRef} style={{ ...monoStyle, display: "flex", flexDirection: "column", gap: 4 }}>
        {stream.events.length === 0 ? (
          <span style={{ color: "var(--ink-3)" }}>no run yet — send a task below</span>
        ) : (
          stream.events.map((event, index) => <EventRow key={index} event={event} />)
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Input
          placeholder="task — e.g. find why tests fail and fix it"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && input.trim() && !stream.running) {
              const text = input.trim();
              setInput("");
              void stream.send(text);
            }
          }}
        />
        <Button
          disabled={input.trim().length === 0 || stream.running}
          onClick={() => {
            const text = input.trim();
            setInput("");
            void stream.send(text);
          }}
        >
          Run
        </Button>
      </div>
    </div>
  );
}

export function CodeSettings() {
  const { sessionsQuery } = useCodeData();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = sessionsQuery.data?.sessions ?? [];
  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  return (
    <div style={pageStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "var(--text-lg)", color: "var(--ink)" }}>Code sessions</h2>
        {!creating ? <Button onClick={() => setCreating(true)}>New session</Button> : null}
      </div>

      {creating ? <NewSession onDone={() => setCreating(false)} /> : null}

      {sessions.length === 0 && !creating ? (
        <EmptyState
          title="No code sessions"
          description="A session pairs an online machine with a folder — the agent works there with read, write, patch and command tools."
        />
      ) : (
        <div style={gridStyle}>
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => setSelectedId(session.id)}
              style={{
                ...cardStyle,
                cursor: "pointer",
                textAlign: "left",
                borderColor: session.id === selectedId ? "var(--accent)" : "var(--line)",
              }}
            >
              <strong style={{ color: "var(--ink)" }}>{session.title}</strong>
              <span style={{ color: "var(--ink-3)", fontSize: "var(--text-sm)", fontFamily: "var(--font-mono, monospace)" }}>{session.folder}</span>
            </button>
          ))}
        </div>
      )}

      {selected ? <SessionDetail session={selected} /> : null}
    </div>
  );
}
