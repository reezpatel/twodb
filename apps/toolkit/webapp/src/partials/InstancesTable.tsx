import { Settings2, Trash2 } from "lucide-react";
import { Button } from "@twodb/blocks";
import { Badge } from "../lib/badge.js";
import { DataTable, TableCard, TableEmpty, Td, Tr } from "../lib/data-table.js";
import { formatRelative } from "../lib/format.js";
import type { ConnectorInstance, ConnectorTemplate } from "../lib/toolkit-client.js";

export interface InstancesTableProps {
  instances: ConnectorInstance[];
  templates: ConnectorTemplate[];
  onOpen: (i: ConnectorInstance) => void;
  onEdit: (i: ConnectorInstance) => void;
  onDelete: (i: ConnectorInstance) => void;
}

const healthTone = (i: ConnectorInstance) => (!i.enabled ? "neutral" : i.healthStatus === "error" ? "danger" : i.healthStatus === "ok" ? "success" : "warning");
const healthLabel = (i: ConnectorInstance) => (!i.enabled ? "disabled" : i.healthStatus === "error" ? "error" : i.healthStatus === "ok" ? "connected" : "unchecked");

/** Dumb table of configured (active) connector instances. */
export function InstancesTable(props: InstancesTableProps) {
  return (
    <TableCard>
      {!props.instances.length ? (
        <TableEmpty>No connected instances yet — configure one from the available connectors below.</TableEmpty>
      ) : (
        <DataTable columns={["Name", "Status", { label: "Connector", mobile: false }, { label: "Spaces", mobile: false }, { label: "Agents", mobile: false }, { label: "Last checked", mobile: false }, ""]} minWidth={760}>
          {props.instances.map((i) => (
            <Tr key={i.id} onClick={() => props.onOpen(i)}>
              <Td className="font-medium text-ink">
                <span className="flex items-center gap-2.5">
                  <span className={`inline-block size-2 rounded-full ${!i.enabled ? "bg-stone-400" : i.healthStatus === "error" ? "bg-destructive" : i.healthStatus === "ok" ? "bg-emerald-500" : "bg-warning"}`} />
                  {i.name}
                </span>
              </Td>
              <Td>
                <span title={i.healthError ?? undefined}>
                  <Badge tone={healthTone(i)}>{healthLabel(i)}</Badge>
                </span>
              </Td>
              <Td hideOnMobile><Badge>{props.templates.find((t) => t.id === i.templateId)?.name ?? i.templateId}</Badge></Td>
              <Td hideOnMobile className="text-ink-muted">{i.scope.all ? "All spaces" : `${i.scope.ids.length} space${i.scope.ids.length === 1 ? "" : "s"}`}</Td>
              <Td hideOnMobile className="text-ink-muted">{i.agentIds.length === 0 ? "All agents" : `${i.agentIds.length} agent${i.agentIds.length === 1 ? "" : "s"}`}</Td>
              <Td hideOnMobile className="text-ink-muted">{formatRelative(i.healthCheckedAt, "Never")}</Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="secondary" onClick={() => props.onEdit(i)}>
                    <Settings2 className="size-3.5" />
                    <span className="hidden sm:inline">Configure</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => props.onDelete(i)}>
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
