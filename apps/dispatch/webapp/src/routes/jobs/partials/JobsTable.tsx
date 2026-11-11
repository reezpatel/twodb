import { Badge } from "@twodb/blocks";
import type { Job } from "../../../lib/dispatch-client.js";

export interface JobsTableProps {
  jobs: Job[];
  onOpen: (id: string) => void;
}

/** Dumb job table — one row per job, click to open detail. */
export function JobsTable(props: JobsTableProps) {
  if (!props.jobs.length) {
    return <p className="p-6 text-center text-[13px] text-ink-muted">No jobs yet — launch one with New job.</p>;
  }
  return (
    <table className="w-full text-[12px]">
      <thead>
        <tr className="border-b border-outline text-left text-[11px] uppercase tracking-wide text-ink-muted">
          <th className="px-4 py-2.5 font-medium">Command</th>
          <th className="px-4 py-2.5 font-medium">Runner</th>
          <th className="px-4 py-2.5 font-medium">Resource</th>
          <th className="px-4 py-2.5 font-medium">Status</th>
          <th className="px-4 py-2.5 font-medium">Exit</th>
          <th className="px-4 py-2.5 font-medium">Started</th>
        </tr>
      </thead>
      <tbody>
        {props.jobs.map((j) => (
          <tr
            key={j.id}
            className="cursor-pointer border-b border-outline/50 last:border-0 hover:bg-surface-muted"
            onClick={() => props.onOpen(j.id)}
          >
            <td className="max-w-64 truncate px-4 py-2.5 font-mono">{j.command}</td>
            <td className="px-4 py-2.5">{j.runnerName ?? j.runnerId}</td>
            <td className="px-4 py-2.5 text-ink-muted">{j.resourceId ?? "—"}</td>
            <td className="px-4 py-2.5">
              <Badge tone={j.status === "running" ? "info" : j.status === "completed" ? "success" : j.status === "failed" ? "danger" : "neutral"}>
                {j.status}
              </Badge>
            </td>
            <td className="px-4 py-2.5 font-mono">{j.exitCode ?? "—"}</td>
            <td className="px-4 py-2.5 text-ink-muted">{new Date(j.startedAt).toLocaleTimeString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
