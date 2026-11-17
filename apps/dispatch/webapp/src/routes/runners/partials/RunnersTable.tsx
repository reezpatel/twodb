import { Terminal, Trash2 } from "lucide-react";
import { Button } from "@twodb/blocks";
import { Badge } from "../../../lib/badge.js";
import type { Runner } from "../../../lib/dispatch-client.js";
import { DataTable, TableCard, TableEmpty, Td, Tr } from "../../../lib/data-table.js";
import { formatRelative } from "../../../lib/format.js";

export interface RunnersTableProps {
  runners: Runner[];
  busy: boolean;
  onExec: (r: Runner) => void;
  onDelete: (r: Runner) => void;
}

/** Dumb runner table: status, kind, host metadata, quick actions. */
export function RunnersTable(props: RunnersTableProps) {
  return (
    <TableCard>
      {!props.runners.length ? (
        <TableEmpty>No runners yet.</TableEmpty>
      ) : (
        <DataTable columns={["Name", "Status", { label: "Kind", mobile: false }, { label: "Platform", mobile: false }, { label: "Agent", mobile: false }, { label: "Last seen", mobile: false }, ""]}>
          {props.runners.map((r) => {
            const meta = r.meta ?? {};
            return (
              <Tr key={r.id}>
                <Td className="font-medium text-ink">
                  <span className="flex items-center gap-2.5">
                    <span className={`inline-block size-2 rounded-full ${r.status === "online" ? "bg-emerald-500" : "bg-stone-400"}`} />
                    {r.name}
                  </span>
                </Td>
                <Td><Badge tone={r.status === "online" ? "success" : "neutral"}>{r.status}</Badge></Td>
                <Td hideOnMobile><Badge>{r.kind === "microvm-host" ? "microvm host" : "host"}</Badge></Td>
                <Td hideOnMobile className="text-ink-muted">{String(meta.os ?? "?")}/{String(meta.arch ?? "?")}</Td>
                <Td hideOnMobile className="text-ink-muted">{String(meta.version ?? "?")}</Td>
                <Td hideOnMobile className="text-ink-muted">{r.lastSeenAt ? formatRelative(r.lastSeenAt) : "Never connected"}</Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" disabled={r.status !== "online"} onClick={() => props.onExec(r)}>
                      <Terminal className="size-3.5" />
                      <span className="hidden sm:inline">Exec</span>
                    </Button>
                    <Button size="sm" variant="ghost" disabled={props.busy} onClick={() => props.onDelete(r)}>
                      <Trash2 className="size-3.5" />
                      <span className="sr-only sm:not-sr-only">Remove</span>
                    </Button>
                  </div>
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      )}
    </TableCard>
  );
}
