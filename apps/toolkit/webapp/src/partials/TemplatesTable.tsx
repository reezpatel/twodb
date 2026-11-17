import { Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import { Badge } from "../lib/badge.js";
import { DataTable, TableCard, TableEmpty, Td, Tr } from "../lib/data-table.js";
import type { ConnectorInstance, ConnectorTemplate } from "../lib/toolkit-client.js";

export interface TemplatesTableProps {
  templates: ConnectorTemplate[];
  instances: ConnectorInstance[];
  onConnect: (t: ConnectorTemplate) => void;
}

/** Dumb table of every connector template that can be configured. */
export function TemplatesTable(props: TemplatesTableProps) {
  return (
    <TableCard>
      {!props.templates.length ? (
        <TableEmpty>No connectors available.</TableEmpty>
      ) : (
        <DataTable columns={["Connector", { label: "Description", mobile: false }, { label: "Tools", mobile: false }, { label: "Broadcasts", mobile: false }, "Instances", ""]} minWidth={760}>
          {props.templates.map((t) => {
            const count = props.instances.filter((i) => i.templateId === t.id).length;
            return (
              <Tr key={t.id}>
                <Td className="font-medium text-ink">{t.name}</Td>
                <Td hideOnMobile className="max-w-[26rem] truncate text-ink-muted" >
                  <span title={t.description}>{t.description}</span>
                </Td>
                <Td hideOnMobile className="text-ink-muted">{t.commands.length}</Td>
                <Td hideOnMobile className="text-ink-muted">{t.broadcasts.length || "—"}</Td>
                <Td>{count ? <Badge tone="success">{`${count} connected`}</Badge> : <span className="text-ink-muted">—</span>}</Td>
                <Td className="text-right">
                  <Button size="sm" variant="secondary" onClick={() => props.onConnect(t)}>
                    <Plus className="size-3.5" />
                    <span className="hidden sm:inline">Connect</span>
                  </Button>
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      )}
    </TableCard>
  );
}
