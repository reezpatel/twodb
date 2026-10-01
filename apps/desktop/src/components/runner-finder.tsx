import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, File, FileArchive, FileCode2, FileImage, FileText, Folder, FolderOpen, Loader2, MonitorSmartphone } from "lucide-react";
import { useRunnerFinder, type FinderSelectionMode, type FinderSelection } from "./use-runner-finder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ROW_CLASSES = "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent";

const CODE_EXTS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "py",
  "rs",
  "go",
  "sh",
  "bash",
  "yaml",
  "yml",
  "toml",
  "css",
  "html",
  "sql",
  "rb",
  "java",
  "c",
  "cpp",
  "h",
  "lock",
];
const TEXT_EXTS = ["md", "mdx", "txt", "log", "ini", "conf", "env", "gitignore"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "avif"];
const ARCHIVE_EXTS = ["zip", "tar", "gz", "bz2", "xz", "7z", "rar"];

function fileIcon(name: string) {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (CODE_EXTS.includes(ext)) return FileCode2;
  if (TEXT_EXTS.includes(ext)) return FileText;
  if (IMAGE_EXTS.includes(ext)) return FileImage;
  if (ARCHIVE_EXTS.includes(ext)) return FileArchive;
  return File;
}

interface RunnerFinderProps {
  mode?: FinderSelectionMode;
  runnerId?: string;
  onSelectionChange?: (selection: FinderSelection | null) => void;
  className?: string;
}

export function RunnerFinder({ mode = "folder", runnerId, onSelectionChange, className }: RunnerFinderProps) {
  const finder = useRunnerFinder({ mode, runnerId, onSelectionChange });
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (finder.highlight) rowRefs.current.get(finder.highlight)?.scrollIntoView({ block: "nearest" });
  }, [finder.highlight]);

  return (
    <div className={cn("bg-background flex min-h-0 flex-col overflow-hidden rounded-lg border", className)} data-slot="runner-finder">
      <div className="bg-card border-b flex h-9 shrink-0 items-center gap-1 border-b px-1.5">
        <Button variant="ghost" size="icon-sm" aria-label="Back" disabled={!finder.canGoBack} onClick={finder.goBack}>
          <ChevronLeft size={14} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Forward" disabled={!finder.canGoForward} onClick={finder.goForward}>
          <ChevronRight size={14} />
        </Button>
        <div className="relative min-w-0 flex-1">
          <FolderOpen size={12} className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 -translate-y-1/2" aria-hidden="true" />
          <Input
            className="bg-muted/40 h-7 rounded-md border-0 pl-7 font-mono text-xs shadow-none focus-visible:ring-1"
            disabled={finder.isPicker}
            placeholder={finder.isPicker ? "Select a runner…" : "/absolute/path or ~/…"}
            value={finder.pathValue}
            onChange={(e) => finder.setPathDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                finder.commitPath(finder.pathValue);
              }
              if (e.key === "Escape") finder.setPathDraft(null);
            }}
          />
        </div>
        {!finder.isPicker && (
          <Badge variant="secondary" className="max-w-32 shrink-0 truncate" title={finder.runnerName}>
            {finder.runnerName}
          </Badge>
        )}
      </div>

      <div
        tabIndex={0}
        aria-label="File browser"
        className="focus-visible:ring-ring min-h-0 flex-1 overflow-y-auto p-1 outline-none focus-visible:ring-2"
        onKeyDown={finder.handleKeyDown}
      >
        {finder.error ? (
          <div className="text-destructive flex flex-col items-center justify-center gap-1 px-3 py-8 text-center text-xs">
            <span>{finder.error.message}</span>
            <span className="text-muted-foreground/70">Fix the path above and press Enter, or go back.</span>
          </div>
        ) : (finder.isLoading || finder.isRunnersLoading) && finder.rows.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          </div>
        ) : finder.rows.length === 0 ? (
          <div className="text-muted-foreground/70 px-3 py-8 text-center text-xs">{finder.isPicker ? "No runners yet." : "Empty folder."}</div>
        ) : (
          <div className={cn("flex flex-col gap-px", (finder.isLoading || finder.isRunnersLoading) && "pointer-events-none opacity-50")}>
            {finder.rows.map((row) => {
              const isSelected = finder.highlight === row.id;
              const shared = {
                key: row.id,
                type: "button" as const,
                ref: (el: HTMLButtonElement | null) => {
                  if (el) rowRefs.current.set(row.id, el);
                  else rowRefs.current.delete(row.id);
                },
                className: cn(ROW_CLASSES, isSelected && "bg-accent font-medium"),
                onClick: () => finder.setHighlight(row.id),
                onDoubleClick: () => finder.openRow(row),
              };
              if (row.runner) {
                const online = row.runner.online;
                return (
                  <button {...shared} disabled={!online} title={online ? undefined : "Runner offline"}>
                    <MonitorSmartphone size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{row.runner.name}</span>
                    <span className="text-muted-foreground/70 max-w-32 truncate font-mono text-xs">{row.runner.hostname}</span>
                    <span className={cn("size-2 shrink-0 rounded-full", online ? "bg-primary" : "bg-muted-foreground/30")} aria-hidden="true" />
                  </button>
                );
              }
              const entry = row.entry;
              if (!entry) return null;
              const Icon = entry.dir ? Folder : fileIcon(entry.name);
              return (
                <button {...shared}>
                  <Icon size={14} className={cn("shrink-0", entry.dir ? "text-primary/70" : "text-muted-foreground")} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-card border-t text-muted-foreground flex h-6 shrink-0 items-center justify-between border-t px-2 text-[11px]">
        <span>
          {finder.isPicker
            ? `${finder.rows.length} runner${finder.rows.length === 1 ? "" : "s"}`
            : `${finder.entries.length} item${finder.entries.length === 1 ? "" : "s"}`}
        </span>
        <span className="text-muted-foreground/70 hidden sm:block">double-click to open · ↑↓ to move · Enter to open</span>
      </div>
    </div>
  );
}
