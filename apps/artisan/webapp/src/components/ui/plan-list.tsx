import * as React from "react";
import { cn } from "../../lib/cn.js";

/* ---------------------------------------------------------------------------------------------
 * Plan list — adapted from the chatcn `todo-list` for the artisan sidebar.
 *
 * The agent's checklist rendered as a compact rail: a hairline progress segment per step,
 * a status glyph (ring / spinner / drawn check) per row, an in-place "n of total" count and
 * a collapsible fold that shows the step currently in progress. Screen readers hear one
 * polite sentence per status change.
 * ------------------------------------------------------------------------------------------- */

export type PlanStepStatus = "pending" | "in_progress" | "done" | "blocked" | "failed";

export interface PlanStep {
  id: string;
  /** Imperative form: "Run the test suite". */
  title: string;
  /** Present continuous shown while in progress: "Running the test suite". */
  activeTitle?: string;
  status: PlanStepStatus;
  /** A second line in small text, e.g. why a step is blocked. */
  detail?: React.ReactNode;
}

function isSettled(s: PlanStepStatus) {
  return s === "done" || s === "blocked" || s === "failed";
}

/* ---------------------------------------------------------------------------------------------
 * Progress rail
 * ------------------------------------------------------------------------------------------- */

/** One hairline segment per step; past 12 the segments become one continuous rail. */
export function PlanProgress({ items }: { items: PlanStep[] }) {
  if (items.length === 0) return null;
  if (items.length > 12) {
    const settled = items.filter((i) => isSettled(i.status)).length;
    return (
      <span aria-hidden="true" className="block h-0.5 overflow-hidden rounded-full bg-outline">
        <span
          className="block h-full origin-left rounded-full bg-success transition-transform duration-300 motion-reduce:transition-none"
          style={{ transform: `scaleX(${settled / items.length})` }}
        />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="flex h-0.5 gap-0.5">
      {items.map((item) => (
        <span
          key={item.id}
          className={cn(
            "h-full flex-1 rounded-full transition-colors duration-150 motion-reduce:transition-none",
            item.status === "done" && "bg-success",
            item.status === "in_progress" && "bg-ink-muted",
            (item.status === "blocked" || item.status === "failed") && "bg-destructive",
            item.status === "pending" && "bg-outline",
          )}
        />
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Status glyph
 * ------------------------------------------------------------------------------------------- */

const STATUS_TEXT: Record<PlanStepStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
  failed: "Failed",
};

/** Remembers whether a value changed since mount, so restored plans mount still. */
function useChangedSinceMount<T>(value: T) {
  const first = React.useRef(value);
  const changed = React.useRef(false);
  if (!Object.is(value, first.current)) changed.current = true;
  return changed.current;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("size-3.5 shrink-0 animate-spin", className)}>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <path d="M8 1.75A6.25 6.25 0 0 1 14.25 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** The check inside the done disc draws itself when a step you watched finishes. */
function DrawnCheck({ draw }: { draw: boolean }) {
  const ref = React.useRef<SVGSVGElement>(null);
  React.useLayoutEffect(() => {
    if (!draw) return;
    const path = ref.current?.querySelector("path");
    if (!path || typeof path.animate !== "function") return;
    const length = path.getTotalLength();
    const anim = path.animate(
      [
        { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
        { strokeDasharray: `${length}`, strokeDashoffset: "0" },
      ],
      { duration: 180, delay: 40, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" },
    );
    return () => anim.cancel();
  }, [draw]);
  return (
    <svg ref={ref} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-2.5" aria-hidden="true">
      <path d="m4.5 12.75 3.23 3.23a2.5 2.5 0 0 0 3.54 0l8.48-8.48" />
    </svg>
  );
}

function StatusGlyph({ status, className }: { status: PlanStepStatus; className?: string }) {
  const changed = useChangedSinceMount(status);
  let glyph: React.ReactNode;
  let tone = "text-ink-muted";
  switch (status) {
    case "in_progress":
      glyph = <Spinner className="text-info" />;
      break;
    case "done":
      glyph = (
        <span className="grid size-3.5 place-items-center rounded-full bg-success text-success-foreground">
          <DrawnCheck draw={changed} />
        </span>
      );
      break;
    case "blocked":
      glyph = <span className="grid size-3.5 place-items-center rounded-full bg-warning text-warning-foreground"><span className="text-[9px] leading-none font-bold">!</span></span>;
      tone = "text-warning";
      break;
    case "failed":
      glyph = <span className="grid size-3.5 place-items-center rounded-full bg-destructive text-destructive-foreground"><span className="text-[9px] leading-none font-bold">×</span></span>;
      tone = "text-destructive";
      break;
    default:
      glyph = <span className="size-3.5 rounded-full shadow-[inset_0_0_0_1.5px_var(--outline)]" />;
  }
  return (
    <span aria-hidden="true" data-task-status={status} className={cn("relative grid size-4 shrink-0 place-items-center", tone, className)}>
      <span key={status} className={cn("grid place-items-center", changed && "motion-safe:animate-[plan-swap_150ms_ease-out]")}>{glyph}</span>
    </span>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Announcements
 * ------------------------------------------------------------------------------------------- */

/** One polite sentence when a step finishes or starts, never a re-read of the whole plan. */
function useAnnouncement(items: PlanStep[]) {
  const previous = React.useRef(new Map(items.map((i) => [i.id, i.status])));
  const [message, setMessage] = React.useState("");
  React.useEffect(() => {
    const done = items.filter((i) => i.status === "done").length;
    let next = "";
    for (const item of items) {
      const was = previous.current.get(item.id);
      if (was === undefined || was === item.status) continue;
      if (item.status === "done") next = `Done: ${item.title}. ${done} of ${items.length} done.`;
      else if (item.status === "in_progress") next = `Started: ${item.activeTitle ?? item.title}.`;
      else next = `${STATUS_TEXT[item.status]}: ${item.title}.`;
    }
    previous.current = new Map(items.map((i) => [i.id, i.status]));
    if (next) setMessage(next);
  }, [items]);
  return message;
}

/** Ids present on first render. Only steps added later fade in, so restored plans mount still. */
function useInitialIds(ids: string[]) {
  const [initial] = React.useState(() => new Set(ids));
  return initial;
}

/* ---------------------------------------------------------------------------------------------
 * Row
 * ------------------------------------------------------------------------------------------- */

function PlanItemRow({ item, animate }: { item: PlanStep; animate: boolean }) {
  const active = item.status === "in_progress";
  const struck = item.status === "done";
  return (
    <li
      data-slot="plan-item"
      data-task-status={item.status}
      className={cn("flex min-w-0 items-start gap-2.5 py-1", animate && "transition-opacity duration-200 starting:opacity-0")}
    >
      <span className="flex h-5 shrink-0 items-center">
        <StatusGlyph status={item.status} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "text-pretty text-[12px] leading-snug transition-colors duration-150",
            active ? "font-medium text-ink" : "text-ink",
            struck && "text-ink-muted line-through decoration-1",
            item.status === "pending" && "text-ink-muted",
          )}
        >
          <span className="sr-only">{STATUS_TEXT[item.status]}: </span>
          {active && item.activeTitle ? item.activeTitle : item.title}
        </span>
        {item.detail ? <span className="text-[10px] leading-tight text-ink-muted">{item.detail}</span> : null}
      </span>
    </li>
  );
}

/* ---------------------------------------------------------------------------------------------
 * PlanList
 * ------------------------------------------------------------------------------------------- */

export interface PlanListProps extends Omit<React.ComponentProps<"div">, "title"> {
  items: PlanStep[];
  /** Heading. Defaults to "Plan". */
  title?: React.ReactNode;
  /** Still writing the plan — shows a quiet "Planning…" row. */
  loading?: boolean;
  /** Fold to one line showing the step in progress (controlled/uncontrolled, default open). */
  collapsible?: boolean;
  /** Hide the built-in header row (e.g. when an outer section already provides one). */
  hideHeader?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  empty?: React.ReactNode;
}

/** "n of total" in tabular figures so the width never jitters as the count climbs. */
export function PlanCount({ items, className }: { items: PlanStep[]; className?: string }) {
  const done = items.filter((i) => i.status === "done").length;
  return (
    <span data-slot="plan-count" className={cn("shrink-0 font-mono text-[10px] tabular-nums text-ink-muted", className)}>
      {done} of {items.length}
      <span className="sr-only"> done</span>
    </span>
  );
}

/**
 * The agent's plan: a ring waits, a spinner works, an ink disc with a drawn check is done.
 * The count reads "n of total" in place; a collapsible header folds to the step in progress.
 */
export function PlanList({
  items,
  title = "Plan",
  loading = false,
  collapsible = true,
  hideHeader = false,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  empty = "No plan yet — the agent uses update_plan.",
  className,
  ...props
}: PlanListProps) {
  const initial = useInitialIds(items.map((i) => i.id));
  const announcement = useAnnouncement(items);
  const [openState, setOpenState] = React.useState(defaultOpen);
  const open = collapsible ? (openProp ?? openState) : true;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };

  const current =
    items.find((i) => i.status === "in_progress") ??
    items.find((i) => i.status === "blocked") ??
    items.find((i) => i.status === "pending");
  const allDone = items.length > 0 && items.every((i) => isSettled(i.status));

  const body =
    items.length === 0 && !loading ? (
      <p className="py-1 text-[11px] text-ink-muted">{empty}</p>
    ) : (
      <ul aria-label={typeof title === "string" ? title : "Plan"} className="flex flex-col">
        {items.map((item) => (
          <PlanItemRow key={item.id} item={item} animate={!initial.has(item.id)} />
        ))}
        {loading ? (
          <li className="flex items-center gap-2.5 py-1">
            <span className="size-4 shrink-0" />
            <span className="text-[11px] font-medium text-ink-muted">Planning…</span>
          </li>
        ) : null}
      </ul>
    );

  const summary =
    collapsible && !open && current ? (
      <span className="flex min-w-0 items-center gap-2">
        <StatusGlyph status={current.status} />
        <span key={current.id} className="truncate font-medium text-ink">
          {current.status === "in_progress" && current.activeTitle ? current.activeTitle : current.title}
        </span>
      </span>
    ) : (
      <span className="flex min-w-0 items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0 text-ink-muted" aria-hidden="true">
          <path d="m3 6.5 1.04 1.04a1 1 0 0 0 1.42 0L8.5 4.5" />
          <path d="m3 17.5 1.04 1.04a1 1 0 0 0 1.42 0L8.5 15.5" />
          <path d="M12.5 6h8" />
          <path d="M12.5 12h8" />
          <path d="M12.5 18h8" />
        </svg>
        <span className="truncate font-medium text-ink">{allDone && items.length > 0 ? "All done" : title}</span>
      </span>
    );

  return (
    <div data-slot="plan-list" className={cn("flex min-w-0 flex-col", className)} {...props}>
      {hideHeader ? null : (
      <button
        type="button"
        aria-expanded={open}
        disabled={!collapsible}
        onClick={collapsible ? () => setOpen(!open) : undefined}
        className={cn(
          "flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-1 text-start transition-colors",
          collapsible && "cursor-pointer hover:bg-surface-muted/60",
          !collapsible && "cursor-default",
        )}
      >
        <span className="min-w-0 flex-1 text-[12px] leading-tight">{summary}</span>
        {items.length > 0 ? <PlanCount items={items} /> : null}
        {collapsible ? (
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
            className={cn("size-3.5 shrink-0 text-ink-muted transition-transform duration-200 motion-reduce:transition-none", open ? "rotate-180" : "")}
          >
            <path d="m6 9.25 4.23 4.23a2.5 2.5 0 0 0 3.54 0L18 9.25" />
          </svg>
        ) : null}
      </button>
      )}

      <div className="px-1 pb-1"><PlanProgress items={items} /></div>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-0.5">{body}</div>
        </div>
      </div>

      <style>{`@keyframes plan-swap { from { opacity: 0; transform: translateY(1px);} to { opacity: 1; transform: none; } }`}</style>
      <span aria-live="polite" className="sr-only">{announcement}</span>
    </div>
  );
}

export default PlanList;
