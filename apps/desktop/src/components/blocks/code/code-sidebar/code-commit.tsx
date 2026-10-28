import type { ComponentProps, ReactNode } from "react";
import { ChevronDown, FileDiff, FileMinus, FilePen, FilePlus, FileQuestion, Folder, GitBranch, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type CodeCommitFileStatus = "modified" | "added" | "deleted" | "renamed" | "untracked";

const FILE_STATUS: Record<CodeCommitFileStatus, { icon: LucideIcon; tone: string; label: string }> = {
  modified: { icon: FilePen, tone: "text-warning", label: "modified" },
  added: { icon: FilePlus, tone: "text-success", label: "added" },
  deleted: { icon: FileMinus, tone: "text-destructive", label: "deleted" },
  renamed: { icon: FileDiff, tone: "text-info", label: "renamed" },
  untracked: { icon: FileQuestion, tone: "text-muted-foreground", label: "untracked" },
};

export function CodeCommit({ className, ...props }: ComponentProps<typeof Collapsible>) {
  return <Collapsible data-slot="code-commit" className={cn("group/commit border-b last:border-b-0", className)} {...props} />;
}

export function CodeCommitHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-commit-header" className={cn("flex items-center", className)} {...props} />;
}

export function CodeCommitTrigger({ className, children, ...props }: ComponentProps<typeof CollapsibleTrigger>) {
  return (
    <CollapsibleTrigger
      data-slot="code-commit-trigger"
      className={cn(
        "hover:bg-accent/50 focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset",
        className,
      )}
      {...props}
    >
      <ChevronDown size={16} className="text-muted-foreground shrink-0 transition-transform group-data-[state=closed]/commit:-rotate-90" aria-hidden="true" />
      {children}
    </CollapsibleTrigger>
  );
}

export function CodeCommitTitle({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="code-commit-title" className={cn("truncate", className)} {...props} />;
}

type CodeCommitCountsProps = ComponentProps<"span"> & {
  /** Null hides the figure, e.g. for binary or untracked files with no line counts. */
  additions: number | null;
  deletions: number | null;
};

export function CodeCommitCounts({ additions, deletions, className, ...props }: CodeCommitCountsProps) {
  return (
    <span data-slot="code-commit-counts" className={cn("flex shrink-0 gap-2 font-mono text-xs font-normal tabular-nums", className)} {...props}>
      {additions !== null ? (
        <span className="text-success" aria-label={`${additions} additions`}>
          +{additions}
        </span>
      ) : null}
      {deletions !== null ? (
        <span className="text-destructive" aria-label={`${deletions} deletions`}>
          −{deletions}
        </span>
      ) : null}
    </span>
  );
}

export function CodeCommitActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="code-commit-actions" className={cn("flex shrink-0 items-center gap-1 pr-2", className)} {...props} />;
}

type CodeCommitActionProps = Omit<ComponentProps<typeof Button>, "children"> & {
  icon: ReactNode;
  label: string;
};

export function CodeCommitAction({ icon, label, variant = "ghost", size = "icon-sm", ...props }: CodeCommitActionProps) {
  return (
    <Button data-slot="code-commit-action" variant={variant} size={size} title={label} aria-label={label} {...props}>
      {icon}
    </Button>
  );
}

export function CodeCommitRefreshAction({
  spinning = false,
  label = "Refresh",
  ...props
}: Omit<CodeCommitActionProps, "icon" | "label"> & { spinning?: boolean; label?: string }) {
  return <CodeCommitAction label={label} icon={<RefreshCw size={12} className={spinning ? "animate-spin" : undefined} />} {...props} />;
}

export function CodeCommitContent({ className, ...props }: ComponentProps<typeof CollapsibleContent>) {
  return <CollapsibleContent data-slot="code-commit-content" className={cn("pb-2", className)} {...props} />;
}

type CodeCommitBranchProps = ComponentProps<"div"> & {
  name: string;
  ahead?: number | null;
  behind?: number | null;
};

export function CodeCommitBranch({ name, ahead = null, behind = null, className, ...props }: CodeCommitBranchProps) {
  return (
    <div data-slot="code-commit-branch" className={cn("flex min-h-7 items-center gap-2 px-3 text-xs", className)} {...props}>
      <GitBranch size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
      <span className="truncate font-mono">{name}</span>
      {ahead !== null ? (
        <span className={cn("shrink-0 font-mono", ahead > 0 ? "text-success" : "text-muted-foreground")}>
          {ahead > 0 ? `↑${ahead}` : "0"}
          {behind !== null && behind > 0 ? ` ↓${behind}` : ""}
        </span>
      ) : null}
    </div>
  );
}

type CodeCommitFolderProps = Omit<ComponentProps<typeof Collapsible>, "title"> & {
  name: string;
  additions: number | null;
  deletions: number | null;
};

export function CodeCommitFolder({ name, additions, deletions, className, children, defaultOpen = true, ...props }: CodeCommitFolderProps) {
  return (
    <Collapsible data-slot="code-commit-folder" defaultOpen={defaultOpen} className={cn("group/folder", className)} {...props}>
      <CollapsibleTrigger className="hover:bg-accent/50 focus-visible:ring-ring flex min-h-7 w-full items-center gap-2 px-3 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset">
        <ChevronDown size={14} className="text-muted-foreground shrink-0 transition-transform group-data-[state=closed]/folder:-rotate-90" aria-hidden="true" />
        <Folder size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-mono" title={name}>
          {name}
        </span>
        <CodeCommitCounts additions={additions} deletions={deletions} />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

type CodeCommitFileProps = ComponentProps<"div"> & {
  name: string;
  /** Full path, shown on hover. */
  path: string;
  status: CodeCommitFileStatus;
  additions: number | null;
  deletions: number | null;
  /** Indent under a folder row. */
  nested?: boolean;
};

export function CodeCommitFile({ name, path, status, additions, deletions, nested = false, className, ...props }: CodeCommitFileProps) {
  const { icon: Icon, tone, label } = FILE_STATUS[status];
  return (
    <div data-slot="code-commit-file" className={cn("flex min-h-7 items-center gap-2 pr-3 text-xs", nested ? "pl-9" : "pl-3", className)} {...props}>
      <Icon size={14} className={cn("shrink-0", tone)} aria-label={label} />
      <span className="text-foreground/85 min-w-0 flex-1 truncate font-mono" title={`${path} — ${label}`}>
        {name}
      </span>
      <CodeCommitCounts additions={additions} deletions={deletions} />
    </div>
  );
}

type CodeCommitMessageProps = ComponentProps<"p"> & {
  tone?: "muted" | "destructive";
};

export function CodeCommitMessage({ tone = "muted", className, ...props }: CodeCommitMessageProps) {
  return (
    <p
      data-slot="code-commit-message"
      className={cn("px-3 py-1 text-sm", tone === "destructive" ? "text-destructive flex items-center gap-2" : "text-muted-foreground", className)}
      {...props}
    />
  );
}
