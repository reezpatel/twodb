import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { CODE_SIDEBAR_LIST_MAX_HEIGHT, CODE_SIDEBAR_STATUS_TONE, CodeSidebarStatusIcon, sortByStatus, type CodeSidebarStatus } from "./code-sidebar-status";

export interface CodeSubagent {
  id: string;
  title: string;
  status: Extract<CodeSidebarStatus, "running" | "idle" | "closed">;
  /** Muted second line, e.g. "depth 1 · headless". */
  detail?: string;
}

export interface CodeSubagentsProps extends Omit<ComponentProps<"ul">, "onSelect" | "children"> {
  subagents: CodeSubagent[];
  /** Opens the subagent's session. */
  onSelect?: (id: string) => void;
}

/** Child sessions of the current session: status glyph, title and a muted detail line. Running first, then idle, closed last; scrolls past about four rows. Presentational — the parent owns the data. */
export function CodeSubagents({ subagents, onSelect, className, ...props }: CodeSubagentsProps) {
  return (
    <ul data-slot="code-subagents" className={cn("flex flex-col", CODE_SIDEBAR_LIST_MAX_HEIGHT, className)} {...props}>
      {sortByStatus(subagents).map((subagent) => (
        <li
          key={subagent.id}
          className="hover:bg-foreground/4 rounded-lg transition-[opacity,translate,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
        >
          <button
            type="button"
            onClick={() => onSelect?.(subagent.id)}
            title="Open the session — live while it runs"
            className="focus-visible:ring-ring flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left outline-none focus-visible:ring-2"
          >
            <span className="flex h-5 shrink-0 items-center">
              <CodeSidebarStatusIcon status={subagent.status} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm leading-5 font-medium", CODE_SIDEBAR_STATUS_TONE[subagent.status])}>{subagent.title}</span>
              {subagent.detail ? <span className="text-muted-foreground/70 block truncate text-xs leading-4">{subagent.detail}</span> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
