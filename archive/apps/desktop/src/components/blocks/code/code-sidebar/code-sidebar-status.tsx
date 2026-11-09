import { AlertCircle, Bot, CheckCircle2, CircleSlash, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type CodeSidebarStatus = "running" | "done" | "failed" | "idle" | "closed" | "stopped";

const LABELS: Record<CodeSidebarStatus, string> = {
  running: "Running",
  done: "Done",
  failed: "Failed",
  idle: "Idle",
  closed: "Closed",
  stopped: "Stopped",
};

/** Status glyph shared by the subagent and background-job rows. */
export function CodeSidebarStatusIcon({ status, className }: { status: CodeSidebarStatus; className?: string }) {
  const base = cn(
    "size-4 shrink-0 transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-90 starting:opacity-0 motion-reduce:starting:scale-100",
    className,
  );
  const label = LABELS[status];
  switch (status) {
    case "running":
      return <Loader2 aria-label={label} className={cn(base, "animate-spin text-blue-500 motion-reduce:animate-none dark:text-blue-400")} />;
    case "done":
      return <CheckCircle2 aria-label={label} className={cn(base, "text-emerald-600 dark:text-emerald-500")} />;
    case "failed":
      return <AlertCircle aria-label={label} className={cn(base, "text-destructive")} />;
    case "closed":
      return <Lock aria-label={label} className={cn(base, "text-muted-foreground/70")} />;
    case "stopped":
      return <CircleSlash aria-label={label} className={cn(base, "text-muted-foreground/70")} />;
    default:
      return <Bot aria-label={label} className={cn(base, "text-muted-foreground")} />;
  }
}

export const CODE_SIDEBAR_STATUS_TONE: Record<CodeSidebarStatus, string> = {
  running: "text-foreground",
  done: "text-foreground",
  failed: "text-foreground",
  idle: "text-muted-foreground",
  closed: "text-muted-foreground/70",
  stopped: "text-muted-foreground/70",
};

/** Active first, then errored, then finished, then stopped or closed. */
const STATUS_RANK: Record<CodeSidebarStatus, number> = { running: 0, idle: 1, failed: 2, done: 3, stopped: 4, closed: 4 };

/** Stable sort by status rank — items in the same group keep the order they came in. */
export function sortByStatus<T extends { status: CodeSidebarStatus }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => STATUS_RANK[a.item.status] - STATUS_RANK[b.item.status] || a.index - b.index)
    .map(({ item }) => item);
}

/** About four rows tall (a row is ~52px); anything past that scrolls, with a sliver of the fifth showing as a hint. */
export const CODE_SIDEBAR_LIST_MAX_HEIGHT = "max-h-[13.5rem] overflow-y-auto";
