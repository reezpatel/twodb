import type { ComponentProps, ReactNode } from "react";
import { FileCheck2, FileX2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCodeChatToolsOpen } from "./code-chat-tools-open";

export type CodeChatFileChangeKind = "written" | "updated" | "read";

const VERBS: Record<CodeChatFileChangeKind, { done: string; running: string; failed: string; fallback: string }> = {
  written: { done: "wrote", running: "writing", failed: "failed to write", fallback: "file written" },
  updated: { done: "updated", running: "updating", failed: "failed to update", fallback: "file updated" },
  read: { done: "read", running: "reading", failed: "failed to read", fallback: "file read" },
};

type CodeChatFileChangeProps = ComponentProps<"div"> & {
  /** write_file, update_file or read_file. */
  kind?: CodeChatFileChangeKind;
  /** Expanded shows the full path, the actions and the body; collapsed shows the file name. Defaults to the global expand/collapse state. */
  open?: boolean;
  path?: string;
  /** Null or undefined hides the figure. */
  additions?: number | null;
  deletions?: number | null;
  running?: boolean;
  failed?: boolean;
  /** Right side of the first line, e.g. the diff layout toggle and copy button. Shown only when expanded. */
  actions?: ReactNode;
  /** Shown under the first line when expanded and the call failed. */
  error?: string;
};

const fileName = (path: string) => path.split("/").pop() || path;

export function CodeChatFileChange({
  kind = "written",
  open: openProp,
  path,
  additions,
  deletions,
  running = false,
  failed = false,
  error,
  actions,
  className,
  children,
  ...props
}: CodeChatFileChangeProps) {
  const globalOpen = useCodeChatToolsOpen();
  const open = openProp ?? globalOpen ?? false;
  const verbs = VERBS[kind];
  const verb = running ? verbs.running : failed ? verbs.failed : verbs.done;
  const hasCounts = additions != null || deletions != null;

  return (
    <div
      data-slot="code-chat-file-change"
      data-kind={kind}
      data-failed={failed || undefined}
      className={cn("flex flex-col rounded-sm text-[13px]", failed ? "bg-destructive/10" : "bg-muted/60", className)}
      {...props}
    >
      <div className={cn("flex items-center gap-2 px-2", actions && open ? "py-1" : "py-1.5")}>
        {running ? (
          <Loader2 className="text-primary size-3 shrink-0 animate-spin" aria-hidden="true" />
        ) : failed ? (
          <FileX2 className="text-destructive size-3 shrink-0" aria-hidden="true" />
        ) : (
          <FileCheck2 className="text-success size-3 shrink-0" aria-hidden="true" />
        )}
        {path ? (
          <>
            <span className={cn("shrink-0", failed ? "text-destructive font-medium" : "text-muted-foreground")}>{verb}</span>
            <span className="text-foreground min-w-0 truncate font-mono" title={path}>
              {open ? path : fileName(path)}
            </span>
          </>
        ) : (
          <span className={cn("font-medium", failed && "text-destructive")}>{running || failed ? verb : verbs.fallback}</span>
        )}
        {hasCounts ? (
          <span className="ml-auto flex shrink-0 gap-2 font-mono tabular-nums">
            {additions != null ? (
              <span className="text-success" aria-label={`${additions} additions`}>
                +{additions}
              </span>
            ) : null}
            {deletions != null ? (
              <span className="text-destructive" aria-label={`${deletions} deletions`}>
                −{deletions}
              </span>
            ) : null}
          </span>
        ) : null}
        {open && actions ? <span className={cn("flex shrink-0 items-center gap-1", !hasCounts && "ml-auto")}>{actions}</span> : null}
      </div>
      {open && failed && error ? <p className="text-destructive px-2 pb-1.5 font-mono whitespace-pre-wrap">{error}</p> : null}
      {open && !failed && children ? <div className="border-t">{children}</div> : null}
    </div>
  );
}
