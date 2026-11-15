import { useMemo } from "react";
import type { McpServer, Space } from "./lib/toolkit-client.js";
import { cn } from "./lib/cn.js";
import type { ToolkitData } from "./hooks/useToolkitData.js";

/**
 * MCP main view: list of registered servers (select one for detail); empty
 * state offers add. Add/edit/import live in the shell header + dialogs.
 */
export function McpView({ data, active, onSelect, onNew, onEdit }: {
  data: ToolkitData;
  active: McpServer | null;
  onSelect: (server: McpServer) => void;
  onNew: () => void;
  onEdit: (server: McpServer) => void;
}) {
  const sorted = useMemo(() => [...data.mcpServers].sort((a, b) => a.name.localeCompare(b.name)), [data.mcpServers]);

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      {active ? (
        <div className="mx-auto max-w-3xl">
          <McpDetail server={active} spaces={data.spaces} onEdit={() => onEdit(active)} />
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <p className="text-[13px] text-ink-muted">No MCP servers yet — add one or paste your editor's <code className="font-mono">mcpServers</code> JSON.</p>
          <button type="button" onClick={onNew} className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-foreground">
            Add server
          </button>
        </div>
      ) : (
        <ul className="mx-auto flex max-w-3xl flex-col gap-2">
          {sorted.map((s) => (
            <li key={s.id} className="group flex items-center gap-3 rounded-lg border border-outline/60 bg-surface px-4 py-3 transition-colors hover:border-outline-strong">
              <span className={cn("size-2 shrink-0 rounded-full", s.enabled ? "bg-emerald-500" : "bg-outline-strong")} />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(s)}>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-semibold">{s.name}</span>
                  <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-ink-muted">{s.transport}</span>
                  {!s.enabled ? <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-warning">disabled</span> : null}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-muted">{s.url}</span>
              </button>
              <span className="text-[11px] text-ink-muted">
                {s.scope.all ? "all spaces" : `${s.scope.ids.length} space${s.scope.ids.length === 1 ? "" : "s"}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function McpDetail({ server, spaces, onEdit }: { server: McpServer; spaces: Space[]; onEdit: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-mono text-[18px] font-semibold">{server.name}</h2>
          <p className="truncate font-mono text-[12px] text-ink-muted">{server.url}</p>
        </div>
        <button type="button" onClick={onEdit} className="rounded-md border border-outline/60 px-2.5 py-1.5 text-[12px] text-ink-muted hover:border-outline-strong hover:text-ink">
          Edit
        </button>
      </div>
      <dl className="grid grid-cols-[130px_1fr] gap-y-2 text-[13px]">
        <dt className="text-ink-muted">Transport</dt>
        <dd className="font-mono">{server.transport}</dd>
        <dt className="text-ink-muted">Enabled</dt>
        <dd>{server.enabled ? "yes" : "no"}</dd>
        <dt className="text-ink-muted">Spaces</dt>
        <dd>{server.scope.all ? "all spaces" : server.scope.ids.map((id) => spaces.find((s) => s.id === id)?.name ?? id).join(", ")}</dd>
        <dt className="text-ink-muted">Headers</dt>
        <dd className="font-mono text-[12px]">
          {Object.keys(server.headers).length === 0 ? "—" : Object.entries(server.headers).map(([k]) => k).join(", ")}
        </dd>
      </dl>
      <p className="text-[12px] text-ink-muted">
        Stored configuration. Tools will appear as <code className="font-mono">mcp__{server.name}__&lt;tool&gt;</code> when MCP wiring lands.
      </p>
    </div>
  );
}
