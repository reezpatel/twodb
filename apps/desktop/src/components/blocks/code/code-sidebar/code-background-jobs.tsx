import { useState, type ComponentProps, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CODE_SIDEBAR_LIST_MAX_HEIGHT, CODE_SIDEBAR_STATUS_TONE, CodeSidebarStatusIcon, sortByStatus, type CodeSidebarStatus } from "./code-sidebar-status";

export interface CodeBackgroundJob {
  id: string;
  /** The shell command, shown monospaced. */
  command: string;
  status: Extract<CodeSidebarStatus, "running" | "done" | "failed" | "stopped">;
  /** Muted second line, e.g. "3f9a1c2e · done · exit 0". */
  detail?: string;
  /** True while a stop request is in flight. */
  stopping?: boolean;
}

export interface CodeBackgroundJobsProps extends Omit<ComponentProps<"ul">, "children"> {
  jobs: CodeBackgroundJob[];
  /** Stops a running job; the stop button only appears on running jobs. */
  onStop?: (id: string) => void;
  /** Content shown under a job when its row is expanded (e.g. its log tail). Without it rows aren't expandable. */
  renderLogs?: (job: CodeBackgroundJob) => ReactNode;
}

/** Background jobs started by the run_background tool. Running first, then failed, done, and stopped last; scrolls past about four rows. Click a row to expand its logs. Presentational — the parent owns the data. */
export function CodeBackgroundJobs({ jobs, onStop, renderLogs, className, ...props }: CodeBackgroundJobsProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul data-slot="code-background-jobs" className={cn("flex flex-col", CODE_SIDEBAR_LIST_MAX_HEIGHT, className)} {...props}>
      {sortByStatus(jobs).map((job) => {
        const open = openId === job.id && !!renderLogs;
        return (
          <li
            key={job.id}
            className="group hover:bg-foreground/4 relative rounded-lg transition-[opacity,translate,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
          >
            <button
              type="button"
              onClick={() => renderLogs && setOpenId(open ? null : job.id)}
              aria-expanded={renderLogs ? open : undefined}
              title={renderLogs ? (open ? "Hide logs" : "Show logs") : job.command}
              className={cn(
                "focus-visible:ring-ring flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left outline-none focus-visible:ring-2",
                job.status === "running" && onStop && "pr-9 pointer-coarse:pr-9",
              )}
            >
              <span className="flex h-5 shrink-0 items-center">
                <CodeSidebarStatusIcon status={job.status} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate font-mono text-xs leading-5 font-medium", CODE_SIDEBAR_STATUS_TONE[job.status])} title={job.command}>
                  {job.command}
                </span>
                {job.detail ? <span className="text-muted-foreground/70 block truncate font-mono text-[10px] leading-4">{job.detail}</span> : null}
              </span>
            </button>
            {job.status === "running" && onStop ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Stop job"
                aria-label={`Stop ${job.command}`}
                disabled={job.stopping}
                onClick={() => onStop(job.id)}
                className="absolute top-1.5 right-1.5 size-6 opacity-0 transition-[opacity,background-color] duration-150 ease-out group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
              >
                {job.stopping ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
              </Button>
            ) : null}
            {open ? <div className="border-border mx-2 mb-2 rounded-md border bg-muted/40">{renderLogs(job)}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
