import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@twodb/blocks";
import { artisanClient, type AgentInfo } from "../../lib/artisan-client.js";
import { AgentDialog } from "./partials/AgentDialog.js";

/** Agents page: directory agents (auto per runner+dir) + custom agents. */
export function AgentsView() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [dialog, setDialog] = useState<"new" | AgentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setAgents(await artisanClient.listAgents());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const directoryAgents = agents.filter((a) => a.type === "directory");
  const custom = agents.filter((a) => a.type !== "directory");

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">Agents</h2>
          <p className="text-[12px] text-ink-muted">Directory agents apply to every session on their runner+directory; custom agents are invocable as subagents.</p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setDialog("new")}>
          <Plus className="size-3.5" />
          New agent
        </Button>
      </div>
      {error ? <p className="mb-3 text-[12px] text-destructive">{error}</p> : null}

      <h3 className="mb-2 text-[12px] uppercase tracking-wide text-ink-muted">Custom</h3>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {custom.map((a) => (
          <AgentCard key={a.id} agent={a} onEdit={() => setDialog(a)} onDelete={async () => { await artisanClient.deleteAgent(a.id); void refresh(); }} />
        ))}
        {custom.length === 0 ? <p className="text-[12px] text-ink-muted">No custom agents yet.</p> : null}
      </div>

      <h3 className="mb-2 text-[12px] uppercase tracking-wide text-ink-muted">Directory</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {directoryAgents.map((a) => (
          <AgentCard key={a.id} agent={a} onEdit={() => setDialog(a)} />
        ))}
        {directoryAgents.length === 0 ? <p className="text-[12px] text-ink-muted">Created automatically on first session per directory.</p> : null}
      </div>

      {dialog ? (
        <AgentDialog
          agent={dialog === "new" ? null : dialog}
          onClose={() => setDialog(null)}
          onSaved={async () => { setDialog(null); await refresh(); }}
        />
      ) : null}
    </div>
  );
}

function AgentCard(props: { agent: AgentInfo; onEdit: () => void; onDelete?: () => void }) {
  const a = props.agent;
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="truncate text-[14px] font-medium">{a.name}</h4>
            <p className="truncate text-[12px] text-ink-muted">{a.description || "no description"}</p>
          </div>
          {a.type === "directory" ? <Badge tone="neutral">directory</Badge> : <Badge tone="info">{a.type}</Badge>}
        </div>
        <p className="truncate font-mono text-[11px] text-ink-muted">{a.model ?? "session model"}</p>
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={props.onEdit}>Configure</Button>
          {props.onDelete ? (
            <Button size="sm" variant="ghost" onClick={props.onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
