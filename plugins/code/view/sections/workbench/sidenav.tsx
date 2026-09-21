import { useEffect, useState } from "react";
import { Check, Circle, Loader2, Plus } from "lucide-react";
import { Button, Input, Select } from "@twodb/ui";
import type { CodeSession } from "../../../shared/api";
import { nodeRepo } from "../../lib/api";
import { codeSidenavStyles as sidenavStyles } from "./sidenav.style";

function StatusIcon({ status }: { status: "running" | "done" | "idle" }) {
  if (status === "running") {
    return (
      <span className="code-sidenav__status code-sidenav__status--running">
        <Loader2 size={14} aria-hidden="true" />
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="code-sidenav__status code-sidenav__status--done">
        <Check size={14} aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="code-sidenav__status">
      <Circle size={14} aria-hidden="true" />
    </span>
  );
}

function NewSessionDialog({ onDone }: { onDone: (session: CodeSession) => void }) {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [nodes, setNodes] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void nodeRepo.listNodes().then(
      (data) => {
        if (active) setNodes(data.nodes);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, []);

  const online = nodes.filter((node) => node.status === "online");

  useEffect(() => {
    if (!nodeId && online[0]) setNodeId(online[0].id);
  }, [online, nodeId]);

  const create = async () => {
    setPending(true);
    setError(null);
    try {
      const { codeRepo } = await import("../../lib/api");
      const response = await codeRepo.createSession({
        title: title.trim(),
        node_id: nodeId,
        folder: folder.trim(),
      });
      onDone(response.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="code-sidenav__dialog">
      <div className="code-sidenav__dialog-body">
        <Input placeholder="Session title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        <Select
          aria-label="Machine"
          placeholder="machine"
          options={[
            { value: "", label: online.length === 0 ? "No online machines" : "Select machine" },
            ...online.map((node) => ({ value: node.id, label: node.name })),
          ]}
          value={nodeId}
          onValueChange={setNodeId}
        />
        <Input placeholder="Folder on machine — e.g. ~/projects/app" value={folder} onChange={(event) => setFolder(event.target.value)} />
        {error ? <p className="code-sidenav__dialog-error">{error}</p> : null}
      </div>
      <div className="code-sidenav__dialog-actions">
        <Button
          size="sm"
          disabled={title.trim().length === 0 || folder.trim().length === 0 || nodeId === "" || pending}
          onClick={() => void create()}
        >
          {pending ? "Creating…" : "Create"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDone(null as unknown as CodeSession)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function Sidenav({
  sessions,
  runningIds,
  selectedId,
  onSelect,
  onCreate,
}: {
  sessions: CodeSession[];
  runningIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (session: CodeSession | null) => void;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <aside className="code-sidenav">
      <style jsx>{sidenavStyles}</style>
      <header className="code-sidenav__header">
        <span className="code-sidenav__heading">Sessions</span>
        <button
          type="button"
          className="code-sidenav__new"
          aria-label="New session"
          onClick={() => setCreating(true)}
        >
          <Plus size={15} aria-hidden="true" />
        </button>
      </header>

      {creating ? (
        <NewSessionDialog
          onDone={(session) => {
            setCreating(false);
            if (session) onCreate(session);
          }}
        />
      ) : null}

      <nav className="code-sidenav__list">
        {sessions.length === 0 ? (
          <p className="code-sidenav__empty">No sessions yet — create one with +.</p>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className={`code-sidenav__item${session.id === selectedId ? " is-selected" : ""}`}
              onClick={() => onSelect(session.id)}
            >
              <StatusIcon status={runningIds.has(session.id) ? "running" : "idle"} />
              <span className="code-sidenav__item-main">
                <span className="code-sidenav__item-title">{session.title}</span>
                <span className="code-sidenav__item-sub">{session.folder}</span>
              </span>
            </button>
          ))
        )}
      </nav>
    </aside>
  );
}
