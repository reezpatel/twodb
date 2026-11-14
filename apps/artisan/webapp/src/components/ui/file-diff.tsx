import * as React from "react";
import { Check, ChevronRight, Copy, FileCode2, FileText } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface DiffLine {
  content: string;
  newNumber?: number;
  oldNumber?: number;
  type: "addition" | "context" | "deletion";
}

export interface DiffHunk {
  id: string;
  header?: string;
  /** Unchanged lines skipped between the previous hunk and this one. */
  skipped?: number;
  lines: DiffLine[];
}

export interface FileDiffProps extends Omit<React.ComponentProps<"figure">, "onCopy"> {
  filename: string;
  hunks: DiffHunk[];
  additions?: number;
  deletions?: number;
  defaultOpen?: boolean;
  split?: boolean;
  wrap?: boolean;
  /** Extra controls rendered in the header, before copy/viewed. */
  actions?: React.ReactNode;
  viewed?: boolean;
  onViewedChange?: (viewed: boolean) => void;
  emptyMessage?: string;
}

const SIGN = { addition: "+", context: " ", deletion: "−" } as const;
const ROW_BG = { addition: "bg-success/10", deletion: "bg-destructive/10", context: "" } as const;

function Row({ line, wrap }: { line: DiffLine; wrap: boolean }) {
  return (
    <span className={cn("grid min-w-max grid-cols-[2.5rem_2.5rem_1rem_1fr] px-2 transition-colors hover:brightness-95 dark:hover:brightness-125", ROW_BG[line.type], wrap && "min-w-0")}>
      <span className="select-none text-right text-ink-muted/60">{line.oldNumber ?? ""}</span>
      <span className="select-none text-right text-ink-muted/60">{line.newNumber ?? ""}</span>
      <span className={cn("select-none text-center", line.type === "addition" ? "text-success" : line.type === "deletion" ? "text-destructive" : "text-ink-muted")}>
        {SIGN[line.type]}
      </span>
      <span className={cn("pr-4 text-ink", wrap ? "whitespace-pre-wrap break-all" : "whitespace-pre")}>{line.content || " "}</span>
    </span>
  );
}

interface SplitPair {
  left?: DiffLine;
  right?: DiffLine;
}

function pair(lines: DiffLine[]): SplitPair[] {
  const out: SplitPair[] = [];
  for (let i = 0; i < lines.length; ) {
    if (lines[i].type === "context") {
      out.push({ left: lines[i], right: lines[i] });
      i++;
      continue;
    }
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < lines.length && lines[i].type === "deletion") dels.push(lines[i++]);
    while (i < lines.length && lines[i].type === "addition") adds.push(lines[i++]);
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) out.push({ left: dels[k], right: adds[k] });
  }
  return out;
}

function SplitRow({ p, wrap }: { p: SplitPair; wrap: boolean }) {
  const cell = (line: DiffLine | undefined, side: "left" | "right") => (
    <span className={cn("grid min-w-0 grid-cols-[2.5rem_1fr] px-2", line ? (line.type === "context" ? "" : ROW_BG[line.type]) : "bg-surface-muted/40")}>
      <span className="select-none text-right text-ink-muted/60 pr-2">{(side === "left" ? line?.oldNumber : line?.newNumber) ?? ""}</span>
      <span className={cn("pr-2 text-ink", wrap ? "whitespace-pre-wrap break-all" : "overflow-hidden text-ellipsis whitespace-pre")}>{line ? line.content || " " : ""}</span>
    </span>
  );
  return (
    <span className="grid grid-cols-2 divide-x divide-outline">
      {cell(p.left, "left")}
      {cell(p.right, "right")}
    </span>
  );
}

/** Card-style per-file diff: collapsible header with +/−, copy patch, viewed toggle; hunks with gap markers. */
export function FileDiff({
  filename, hunks, additions, deletions, defaultOpen = true, split = false, wrap = false, actions, viewed, onViewedChange, emptyMessage, className, ...props
}: FileDiffProps) {
  const bodyId = React.useId();
  const all = React.useMemo(() => hunks.flatMap((h) => h.lines), [hunks]);
  const added = additions ?? all.filter((l) => l.type === "addition").length;
  const removed = deletions ?? all.filter((l) => l.type === "deletion").length;
  const [internalViewed, setInternalViewed] = React.useState(false);
  const isViewed = viewed ?? internalViewed;
  const [open, setOpen] = React.useState(defaultOpen && !isViewed);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  const toggleViewed = () => {
    const next = !isViewed;
    if (viewed === undefined) setInternalViewed(next);
    if (next) setOpen(false);
    onViewedChange?.(next);
  };

  const copy = () => {
    const patch = hunks
      .flatMap((h) => [h.header ?? "", ...h.lines.map((l) => `${l.type === "addition" ? "+" : l.type === "deletion" ? "-" : " "}${l.content}`)])
      .filter((l, i) => i > 0 || l !== "")
      .join("\n");
    void navigator.clipboard?.writeText(patch).catch(() => undefined);
    setCopied(true);
  };

  const iconButton = "flex size-6 items-center justify-center rounded-md text-ink-muted outline-none transition-colors hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/20";
  const isCode = /\.(tsx?|jsx?|json|css|html|py|rs|go|md|sql|sh|ya?ml)$/i.test(filename);

  return (
    <figure
      data-slot="file-diff"
      data-viewed={isViewed}
      className={cn("overflow-hidden rounded-2xl border border-outline bg-surface text-sm text-ink-muted shadow-sm", className)}
      {...props}
    >
      <figcaption className="flex h-10 items-center gap-2 pl-1.5 pr-2 text-xs leading-5">
        <button type="button" aria-controls={bodyId} aria-expanded={open} aria-label={open ? `Collapse ${filename}` : `Expand ${filename}`} className={iconButton} onClick={() => setOpen((v) => !v)}>
          <ChevronRight className={cn("size-3.5 transition-transform duration-200", open && "rotate-90")} />
        </button>
        {isCode ? <FileCode2 aria-hidden="true" className="size-4 shrink-0" /> : <FileText aria-hidden="true" className="size-4 shrink-0" />}
        <span className={cn("min-w-0 truncate font-mono text-ink transition-opacity", isViewed && "opacity-60")} title={filename}>{filename}</span>
        <span className="ml-auto tabular-nums text-success">+{added}</span>
        <span className="tabular-nums text-destructive">−{removed}</span>
        {actions}
        <button type="button" aria-label={copied ? "Copied" : "Copy patch"} title={copied ? "Copied" : "Copy patch"} className={iconButton} onClick={copy}>
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-surface-muted">
          <input type="checkbox" checked={isViewed} onChange={toggleViewed} className="size-3.5 accent-current" />
          Viewed
        </label>
      </figcaption>
      {open ? (
        <div id={bodyId} className="border-t border-outline">
          {hunks.length === 0 ? (
            <p className="px-4 py-6 text-[12px]">{emptyMessage ?? "No textual diff."}</p>
          ) : (
            <pre className="overflow-x-auto py-2 font-mono text-[12px] leading-5">
              <code className="block">
                {hunks.map((hunk) => (
                  <React.Fragment key={hunk.id}>
                    {hunk.skipped ? (
                      <span className="flex min-w-max items-center gap-2 bg-surface-muted/50 px-2 py-0.5 text-[11px] text-ink-muted/70">
                        <span className="select-none">⋯ {hunk.skipped} unchanged {hunk.skipped === 1 ? "line" : "lines"}</span>
                      </span>
                    ) : null}
                    {hunk.header ? <span className="flex min-w-max items-center gap-2 px-2 text-ink-muted/60"><span className="select-none">{hunk.header}</span></span> : null}
                    {split
                      ? pair(hunk.lines).map((p, i) => <SplitRow key={i} p={p} wrap={wrap} />)
                      : hunk.lines.map((line, i) => <Row key={`${line.type}-${i}`} line={line} wrap={wrap} />)}
                  </React.Fragment>
                ))}
              </code>
            </pre>
          )}
        </div>
      ) : null}
    </figure>
  );
}

export default FileDiff;
