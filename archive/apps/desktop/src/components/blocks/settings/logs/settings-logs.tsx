import { useEffect, useRef, type ComponentProps } from "react";
import { Activity, AlertCircle, Info, Loader2, Pause, Play, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LogEntry {
  /** Unique render key — line numbers repeat across rotated files. */
  key: string;
  line: number;
  /** Marker row inserted when the log file was rotated/truncated. */
  divider?: boolean;
  time: string | null;
  level: string | null;
  message: string;
  context: string | null;
}

export type LogLevelFilter = "all" | "info" | "warn" | "error";

export const LOG_LEVEL_FILTERS: LogLevelFilter[] = ["all", "info", "warn", "error"];

const LEVEL_STYLE: Record<string, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  warn: { icon: TriangleAlert, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" },
  error: { icon: AlertCircle, className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

export interface SettingsLogsProps extends ComponentProps<"div"> {
  entries: LogEntry[];
  total: number;
  /** Name of the log file being tailed. */
  file: string | null;
  error: string | null;
  loading: boolean;
  levelFilter: LogLevelFilter;
  onLevelFilterChange: (level: LogLevelFilter) => void;
  /** When true the viewport stays pinned to the newest line. */
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
}

/** Live server-log tail: header with filter and follow toggle, a scrolling list of rows, and an admin footnote. Controlled — the parent owns the data. */
export function SettingsLogs({
  entries,
  total,
  file,
  error,
  loading,
  levelFilter,
  onLevelFilterChange,
  follow,
  onFollowChange,
  className,
  ...props
}: SettingsLogsProps) {
  return (
    <div data-slot="settings-logs" className={cn("bg-card text-card-foreground flex h-full min-h-0 flex-col", className)} {...props}>
      <SettingsLogsHeader
        entryCount={entries.length}
        total={total}
        file={file}
        levelFilter={levelFilter}
        onLevelFilterChange={onLevelFilterChange}
        follow={follow}
        onFollowChange={onFollowChange}
      />
      {error && (
        <p className="text-destructive border-border border-b px-4 py-2 text-sm" role="alert">
          {error}
        </p>
      )}
      <SettingsLogsContent entries={entries} loading={loading} levelFilter={levelFilter} follow={follow} />
    </div>
  );
}

export function SettingsLogsHeader({
  entryCount,
  total,
  file,
  levelFilter,
  onLevelFilterChange,
  follow,
  onFollowChange,
  className,
}: Pick<SettingsLogsProps, "total" | "file" | "levelFilter" | "onLevelFilterChange" | "follow" | "onFollowChange"> & {
  entryCount: number;
  className?: string;
}) {
  return (
    <div data-slot="settings-logs-header" className={cn("border-border bg-muted/30 flex flex-wrap items-center gap-3 border-b px-4 py-3", className)}>
      <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
        <Activity className={cn("size-4", follow ? "animate-pulse text-green-500" : "text-muted-foreground")} />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Server logs</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                follow
                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
              )}
            >
              <span className="relative flex size-2">
                {follow && <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />}
                <span className={cn("relative inline-flex size-2 rounded-full", follow ? "bg-green-500" : "bg-yellow-500")} />
              </span>
              {follow ? "Live" : "Paused"}
            </span>
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {file ?? "server log"} · {entryCount} shown{total > 0 ? ` of ${total} lines` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {LOG_LEVEL_FILTERS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onLevelFilterChange(level)}
            aria-pressed={levelFilter === level}
            className={cn(
              "focus-visible:ring-ring rounded-md px-2 py-1 text-xs capitalize transition-colors focus-visible:ring-2 focus-visible:outline-none",
              levelFilter === level ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {level}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onFollowChange(!follow)}
          title={follow ? "Pause tailing" : "Resume tailing"}
          aria-label={follow ? "Pause tailing" : "Resume tailing"}
          className="hover:bg-muted focus-visible:ring-ring ml-1 inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {follow ? <Pause className="text-muted-foreground size-4" /> : <Play className="text-muted-foreground size-4" />}
        </button>
      </div>
    </div>
  );
}

export function SettingsLogsContent({
  entries,
  loading,
  levelFilter,
  follow,
  className,
}: Pick<SettingsLogsProps, "entries" | "loading" | "levelFilter" | "follow"> & { className?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Follow mode keeps the viewport pinned to the newest line.
  useEffect(() => {
    if (follow && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [entries, follow]);

  if (entries.length === 0) {
    return (
      <div data-slot="settings-logs-content" className={cn("text-muted-foreground flex flex-1 items-center justify-center p-8", className)}>
        <div className="text-center">
          {loading ? <Loader2 className="mx-auto size-8 animate-spin opacity-50" /> : <Activity className="mx-auto size-8 opacity-50" />}
          <p className="mt-2 text-sm">{loading ? "Loading logs…" : `No log lines${levelFilter !== "all" ? ` at ${levelFilter} level` : ""}.`}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} data-slot="settings-logs-content" className={cn("min-h-0 flex-1 overflow-y-auto", className)}>
      <div className="divide-border divide-y">
        {entries.map((entry) => (
          <SettingsLogsRow key={entry.key} entry={entry} />
        ))}
      </div>
    </div>
  );
}

export function SettingsLogsRow({ entry, className }: { entry: LogEntry; className?: string }) {
  if (entry.divider) {
    return (
      <div
        data-slot="settings-logs-row"
        data-type="divider"
        className={cn("text-muted-foreground flex items-center gap-2 px-4 py-2 text-[10px] uppercase", className)}
      >
        <span className="bg-border h-px flex-1" /> {entry.message} <span className="bg-border h-px flex-1" />
      </div>
    );
  }
  const style = entry.level ? LEVEL_STYLE[entry.level] : undefined;
  const Icon = style?.icon;
  return (
    <div
      data-slot="settings-logs-row"
      data-type={entry.level ?? "raw"}
      className={cn("hover:bg-accent/40 flex items-start gap-3 px-4 py-2 text-sm", entry.level === "error" && "bg-red-50/50 dark:bg-red-950/20", className)}
    >
      <span className="text-muted-foreground/60 w-8 shrink-0 pt-0.5 text-right font-mono text-xs">{entry.line}</span>
      <span className="text-muted-foreground w-[5.5rem] shrink-0 pt-0.5 font-mono text-xs">{entry.time ? entry.time.slice(11, 23) : ""}</span>
      <span className="w-16 shrink-0">
        {entry.level && (
          <span
            className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium", style?.className ?? "bg-muted text-muted-foreground")}
          >
            {Icon && <Icon className="size-3.5" />}
            {entry.level}
          </span>
        )}
      </span>
      <span className="text-foreground min-w-0 flex-1 font-mono text-xs break-all whitespace-pre-wrap">
        {entry.message}
        {entry.context && <span className="text-muted-foreground"> {entry.context}</span>}
      </span>
    </div>
  );
}
