import { Badge } from "../../../lib/badge.js";
import type { Job } from "../../../lib/dispatch-client.js";
import { DataTable, TableCard, TableEmpty, Td, Tr } from "../../../lib/data-table.js";
import { formatRelative } from "../../../lib/format.js";

export interface JobsTableProps {
  jobs: Job[];
  onOpen: (id: string) => void;
}

/** Dumb job table — one row per job, click to open detail. */
export function JobsTable(props: JobsTableProps) {
  return (
    <TableCard>
      {!props.jobs.length ? (
        <TableEmpty>No jobs yet.</TableEmpty>
      ) : (
        <DataTable columns={["Command", "Runner", { label: "Resource", mobile: false }, "Status", { label: "Exit", mobile: false }, "Started"]}>
          {props.jobs.map((j) => (
            <Tr key={j.id} onClick={() => props.onOpen(j.id)}>
              <Td className="max-w-40 truncate sm:max-w-64 font-mono font-medium text-ink">{j.command}</Td>
              <Td>{j.runnerName ?? j.runnerId}</Td>
              <Td hideOnMobile className="text-ink-muted">{j.resourceId ?? "—"}</Td>
              <Td>
                <Badge tone={j.status === "running" ? "info" : j.status === "completed" ? "success" : j.status === "failed" ? "danger" : "neutral"}>
                  {j.status}
                </Badge>
              </Td>
              <Td hideOnMobile className="font-mono">{j.exitCode ?? "—"}</Td>
              <Td className="text-ink-muted">{formatRelative(j.startedAt)}</Td>
            </Tr>
          ))}
        </DataTable>
      )}
    </TableCard>
  );
}
