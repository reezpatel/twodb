import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@twodb/blocks";
import { Badge } from "../lib/badge.js";
import { DataTable, TableCard, TableEmpty, Td, Tr } from "../lib/data-table.js";
import type { McpServer } from "../lib/toolkit-client.js";

export interface McpTableProps {
  servers: McpServer[];
  onOpen: (s: McpServer) => void;
  onEdit: (s: McpServer) => void;
  onDelete: (s: McpServer) => void;
}

/** Dumb table of registered MCP servers. */
export function McpTable(props: McpTableProps) {
  return (
    <TableCard>
      {!props.servers.length ? (
        <TableEmpty>No MCP servers yet — add one or import your editor's mcpServers JSON.</TableEmpty>
      ) : (
        <DataTable columns={["Name", "Status", { label: "Transport", mobile: false }, { label: "URL", mobile: false }, { label: "Spaces", mobile: false }, { label: "Agents", mobile: false }, ""]} minWidth={820}>
          {props.servers.map((s) => (
            <Tr key={s.id} onClick={() => props.onOpen(s)}>
              <Td className="font-mono font-medium text-ink">
                <span className="flex items-center gap-2.5">
                  <span className={`inline-block size-2 rounded-full ${s.enabled ? "bg-emerald-500" : "bg-stone-400"}`} />
                  {s.name}
                </span>
              </Td>
              <Td><Badge tone={s.enabled ? "success" : "neutral"}>{s.enabled ? "enabled" : "disabled"}</Badge></Td>
              <Td hideOnMobile><Badge>{s.transport}</Badge></Td>
              <Td hideOnMobile className="max-w-[22rem] truncate font-mono text-ink-muted"><span title={s.url}>{s.url}</span></Td>
              <Td hideOnMobile className="text-ink-muted">{s.scope.all ? "All spaces" : `${s.scope.ids.length} space${s.scope.ids.length === 1 ? "" : "s"}`}</Td>
              <Td hideOnMobile className="text-ink-muted">{s.agentIds.length === 0 ? "All agents" : `${s.agentIds.length} agent${s.agentIds.length === 1 ? "" : "s"}`}</Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="secondary" onClick={() => props.onEdit(s)}>
                    <Pencil className="size-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => props.onDelete(s)}>
                    <Trash2 className="size-3.5" />
                    <span className="sr-only sm:not-sr-only">Remove</span>
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </DataTable>
      )}
    </TableCard>
  );
}
