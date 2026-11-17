import { useMemo } from "react";
import type { McpServer, Space } from "./lib/toolkit-client.js";
import { McpTable } from "./partials/McpTable.js";
import type { ToolkitData } from "./hooks/useToolkitData.js";

/**
 * MCP main view: list of registered servers (select one for detail); empty
 * state offers add. Add/edit/import live in the shell header + dialogs.
 */
export function McpView({ data, active, onSelect, onNew, onEdit, onDelete }: {
  data: ToolkitData;
  active: McpServer | null;
  onSelect: (server: McpServer) => void;
  onNew: () => void;
  onEdit: (server: McpServer) => void;
  onDelete: (server: McpServer) => void;
}) {
  const sorted = useMemo(() => [...data.mcpServers].sort((a, b) => a.name.localeCompare(b.name)), [data.mcpServers]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      {active ? (
        <div className="mx-auto max-w-3xl">
          <McpDetail server={active} spaces={data.spaces} onEdit={() => onEdit(active)} onDelete={() => onDelete(active)} />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-6xl">
          <McpTable servers={sorted} onOpen={onSelect} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

function McpDetail({ server, spaces, onEdit, onDelete }: { server: McpServer; spaces: Space[]; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-mono text-[18px] font-semibold">{server.name}</h2>
          <p className="break-all font-mono text-[12px] text-ink-muted">{server.url}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onEdit} className="rounded-md border border-outline/60 px-2.5 py-1.5 text-[12px] text-ink-muted hover:border-outline-strong hover:text-ink">
            Edit
          </button>
          <button type="button" onClick={onDelete} className="rounded-md border border-outline/60 px-2.5 py-1.5 text-[12px] text-ink-muted hover:border-destructive hover:text-destructive">
            Delete
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[130px_minmax(0,1fr)] gap-y-2 text-[13px]">
        <dt className="text-ink-muted">Transport</dt>
        <dd className="font-mono">{server.transport}</dd>
        <dt className="text-ink-muted">Enabled</dt>
        <dd>{server.enabled ? "yes" : "no"}</dd>
        <dt className="text-ink-muted">Spaces</dt>
        <dd>{server.scope.all ? "all spaces" : server.scope.ids.map((id) => spaces.find((s) => s.id === id)?.name ?? id).join(", ")}</dd>
        <dt className="text-ink-muted">Headers</dt>
        <dd className="break-words font-mono text-[12px]">
          {Object.keys(server.headers).length === 0 ? "—" : Object.entries(server.headers).map(([k]) => k).join(", ")}
        </dd>
      </dl>
      <p className="text-[12px] text-ink-muted">
        Stored configuration. Tools will appear as <code className="font-mono">mcp__{server.name}__&lt;tool&gt;</code> when MCP wiring lands.
      </p>
    </div>
  );
}
