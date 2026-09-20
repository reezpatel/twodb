import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, EmptyState, Input } from "@twodb/ui";
import type { TwodbNodeInfo } from "../../../shared/api";
import { nodeRepo } from "../../lib/api";
import { useNodesData } from "../../hooks/use-nodes-data";
import { useCommandRunner } from "../../hooks/use-command-runner";

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
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: 12,
};

const PLATFORM_LABELS: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  docker: "Docker",
  unknown: "Unknown",
};

const STATUS_COLORS: Record<string, string> = {
  online: "var(--go)",
  offline: "var(--ink-3)",
  unknown: "var(--ink-3)",
};

const monoStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "var(--text-sm)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  margin: 0,
  padding: 12,
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-md)",
};

function CopyLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <p style={{ ...monoStyle, flex: 1 }}>{value}</p>
      <Button
        variant="ghost"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function AddMachine({ onDone }: { onDone: () => void }) {
  const { createNode } = useNodesData();
  const [name, setName] = useState("");
  const token = createNode.data?.token;

  if (token) {
    const snippet = `TWODB_NODE_URL=${window.location.origin} TWODB_NODE_TOKEN=${token} pnpm --filter twodb-node start`;
    return (
      <div style={cardStyle}>
        <h3 style={{ margin: 0, color: "var(--ink)" }}>Machine created — save the token now</h3>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "var(--text-sm)" }}>The token is shown once. Run the agent on the machine with:</p>
        <CopyLine value={snippet} />
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: 0, color: "var(--ink)" }}>Add machine</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <Input placeholder="Machine name — e.g. dev-box, docker-1" value={name} onChange={(event) => setName(event.target.value)} />
        <Button disabled={name.trim().length === 0 || createNode.isPending} onClick={() => createNode.mutate({ name: name.trim() })}>
          {createNode.isPending ? "Creating…" : "Create"}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function NodeCard({ node, selected, onSelect }: { node: TwodbNodeInfo; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        ...cardStyle,
        cursor: "pointer",
        textAlign: "left",
        borderColor: selected ? "var(--accent)" : "var(--line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[node.status] ?? "var(--ink-3)" }} />
        <strong style={{ color: "var(--ink)" }}>{node.name}</strong>
        <Badge>{PLATFORM_LABELS[node.platform] ?? node.platform}</Badge>
      </div>
      <span style={{ color: "var(--ink-3)", fontSize: "var(--text-sm)" }}>
        {node.hostname || "not connected yet"}
        {node.hostname && node.arch ? ` · ${node.arch}` : ""}
      </span>
      <span style={{ color: "var(--ink-3)", fontSize: "var(--text-sm)" }}>
        {node.last_seen_at ? `last seen ${new Date(node.last_seen_at).toLocaleString()}` : "never seen"}
      </span>
    </button>
  );
}

function CommandOutput({ segments }: { segments: Array<{ stream: "stdout" | "stderr"; text: string }> }) {
  if (segments.length === 0) return <p style={{ ...monoStyle, color: "var(--ink-3)" }}>no output yet…</p>;
  return (
    <div style={monoStyle}>
      {segments.map((segment, index) => (
        <span key={index} style={segment.stream === "stderr" ? { color: "var(--danger-ink)" } : undefined}>
          {segment.text}
        </span>
      ))}
    </div>
  );
}

function Runner({ nodeId }: { nodeId: string }) {
  const runner = useCommandRunner();
  const [input, setInput] = useState("");
  const [cwd, setCwd] = useState("");

  const recent = useQuery({
    queryKey: ["node", "commands", nodeId],
    queryFn: () => nodeRepo.recentCommands(nodeId, 10),
    refetchInterval: 15_000,
  });

  return (
    <div style={{ ...cardStyle, gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          placeholder="command — e.g. ls -la, cat src/index.ts"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && input.trim() && !runner.running) {
              void runner.run(nodeId, input.trim(), cwd.trim() || null);
            }
          }}
        />
        <Input placeholder="cwd (optional)" value={cwd} onChange={(event) => setCwd(event.target.value)} style={{ width: 200 }} />
        {runner.running ? (
          <Button onClick={() => void runner.kill()}>Stop</Button>
        ) : (
          <Button disabled={input.trim().length === 0} onClick={() => void runner.run(nodeId, input.trim(), cwd.trim() || null)}>
            Run
          </Button>
        )}
      </div>

      {runner.error ? <span style={{ color: "var(--danger-ink)", fontSize: "var(--text-sm)" }}>{runner.error}</span> : null}
      {runner.command ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--text-sm)", color: "var(--ink-3)" }}>
          <Badge>{runner.command.status}</Badge>
          {runner.command.exit_code != null ? <span>exit {runner.command.exit_code}</span> : null}
        </div>
      ) : null}
      {runner.command ? <CommandOutput segments={runner.segments} /> : null}

      {recent.data && recent.data.commands.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "var(--ink-3)", fontSize: "var(--text-sm)" }}>Recent</span>
          {recent.data.commands.slice(0, 5).map((command) => (
            <span key={command.id} style={{ fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
              <Badge>{command.status}</Badge> {command.command.slice(0, 80)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NodeDetail({ node }: { node: TwodbNodeInfo }) {
  const { removeNode, rotateToken } = useNodesData();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  const actions: ReactNode = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button variant="ghost" onClick={() => rotateToken.mutate(node.id, { onSuccess: (data) => setNewToken(data.token) })}>
        Rotate token
      </Button>
      {confirmDelete ? (
        <>
          <Button variant="danger" onClick={() => removeNode.mutate(node.id)}>
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
  );

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, color: "var(--ink)" }}>
          {node.name} <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· {node.hostname || "not connected"}</span>
        </h3>
        {actions}
      </div>
      {newToken ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ color: "var(--ink-3)", fontSize: "var(--text-sm)" }}>New token — shown once:</span>
          <CopyLine value={newToken} />
        </div>
      ) : null}
      <Runner nodeId={node.id} />
    </div>
  );
}

export function NodesSettings() {
  const { nodesQuery } = useNodesData();
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nodes = nodesQuery.data?.nodes ?? [];
  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  return (
    <div style={pageStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "var(--text-lg)", color: "var(--ink)" }}>Machines</h2>
        {!adding ? <Button onClick={() => setAdding(true)}>Add machine</Button> : null}
      </div>

      {adding ? (
        <AddMachine
          onDone={() => {
            setAdding(false);
            nodesQuery.refetch();
          }}
        />
      ) : null}

      {nodes.length === 0 && !adding ? (
        <EmptyState title="No machines" description="Add a machine and run the node agent on it to start executing commands." />
      ) : (
        <div style={gridStyle}>
          {nodes.map((node) => (
            <NodeCard key={node.id} node={node} selected={node.id === selectedId} onSelect={() => setSelectedId(node.id)} />
          ))}
        </div>
      )}

      {selected ? <NodeDetail node={selected} /> : null}
    </div>
  );
}
