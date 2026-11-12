import { useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "../../../lib/cn.js";

/** Collapsible sidebar section (legacy code-sidebar-section). */
export function SideSection(props: { title: string; count?: number | string; defaultOpen?: boolean; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(props.defaultOpen ?? true);
  return (
    <div data-slot="side-section" className={cn("border-b last:border-b-0", props.className)}>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[13px] font-medium hover:bg-surface-muted/50"
        onClick={() => setOpen((o) => !o)}
      >
        {props.title}
        {props.count !== undefined && props.count !== "" ? <span className="font-normal text-ink-muted">({props.count})</span> : null}
        <ChevronUp size={14} className="ml-auto text-ink-muted transition-transform" style={{ transform: open ? undefined : "rotate(180deg)" }} />
      </button>
      {open ? <div className="px-3 pb-3">{props.children}</div> : null}
    </div>
  );
}

/** Plan step row (legacy code-plan vibe: status glyph + title). */
export function PlanRow(props: { title: string; status: string }) {
  const glyph = props.status === "done" ? "✓" : props.status === "in_progress" ? "◐" : "○";
  const tone = props.status === "done" ? "text-success" : props.status === "in_progress" ? "text-ink" : "text-ink-muted";
  const strike = props.status === "done" ? "line-through text-ink-muted" : "";
  return (
    <li className="flex items-start gap-2 py-0.5 text-[12px]">
      <span className={cn("mt-0.5 shrink-0", tone)}>{glyph}</span>
      <span className={cn("min-w-0 break-words", strike)}>{props.title}</span>
    </li>
  );
}

/** Subagent row: running glyph + title, click to open as a tab. */
export function SubagentRow(props: { title: string; running: boolean; adhoc: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12px] hover:bg-surface-muted/60"
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", props.running ? "animate-pulse bg-success" : "bg-outline-strong")} />
      <span className="truncate">{props.title}</span>
      <span className="ml-auto shrink-0 text-[10px] text-ink-muted">{props.adhoc ? "ad-hoc" : "agent"}</span>
    </button>
  );
}

/** Git file row: status letter + path. */
export function GitFileRow(props: { path: string; status: string }) {
  const tone = props.status.startsWith("D") ? "text-destructive" : props.status.startsWith("A") || props.status.startsWith("?") ? "text-success" : "text-warning";
  return (
    <div className="flex items-center gap-1.5 py-0.5 font-mono text-[11px]">
      <span className={cn("w-3 shrink-0 text-center", tone)}>{props.status.slice(0, 1)}</span>
      <span className="truncate text-ink-muted">{props.path}</span>
    </div>
  );
}

/** Checkpoint row: label + sha + restore/delete. */
export function CheckpointRow(props: { label: string | null; sha: string; createdAt: string; onRestore: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px] hover:bg-surface-muted/60">
      <span className="truncate">{props.label ?? props.sha.slice(0, 8)}</span>
      <span className="ml-auto shrink-0 font-mono text-[10px] text-ink-muted">{new Date(props.createdAt).toLocaleTimeString()}</span>
      <button type="button" className="text-[10px] text-info hover:underline" onClick={props.onRestore}>restore</button>
      <button type="button" className="text-[10px] text-destructive hover:underline" onClick={props.onDelete}>×</button>
    </div>
  );
}
