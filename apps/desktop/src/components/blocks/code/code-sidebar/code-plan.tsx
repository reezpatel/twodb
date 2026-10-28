import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CodePlanCount } from "./code-plan-count";
import { CodePlanDisclosure } from "./code-plan-disclosure";
import { EASE_OUT, SPRING_LAYOUT, SPRING_SWAP } from "./code-plan-motion";

export type CodePlanItemStatus = "pending" | "in-progress" | "completed" | "cancelled";

export interface CodePlanItem {
  id: string;
  title: ReactNode;
  status?: CodePlanItemStatus;
  /** 0–100, sets the length of the spinning arc. Without it the arc has a fixed length. */
  progress?: number;
  detail?: ReactNode;
}

export interface CodePlanProps {
  items: CodePlanItem[];
  title?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Collapse when every item completes, and reopen when a new unfinished item appears. */
  collapseOnComplete?: boolean;
  /** Pixel cap on the list; it scrolls past this and follows new items. */
  maxHeight?: number;
  emptyLabel?: ReactNode;
  className?: string;
}

const STATUS_LABEL: Record<CodePlanItemStatus, string> = {
  pending: "Pending",
  "in-progress": "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function CodePlanStatusIcon({ status, progress }: { status: CodePlanItemStatus; progress?: number }) {
  const reduce = useReducedMotion() ?? false;
  const normalizedProgress = progress === undefined ? 0.68 : Math.min(100, Math.max(0, progress)) / 100;
  const spinning = status === "in-progress" && !reduce;

  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      initial={false}
      className={cn(
        "text-muted-foreground mx-0.5 size-5 shrink-0 overflow-visible",
        status === "in-progress" && "text-foreground",
        status === "completed" && "text-success",
        status === "cancelled" && "text-destructive",
      )}
    >
      <motion.circle
        cx="12"
        cy="12"
        r="9"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={status === "pending" ? "2 3" : undefined}
        strokeLinecap="round"
        initial={false}
        animate={{ fillOpacity: status === "completed" ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.18, ease: EASE_OUT }}
        className={cn(status === "in-progress" && "opacity-20")}
      />
      <motion.circle
        cx="12"
        cy="12"
        r="9"
        pathLength="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        initial={false}
        animate={{
          pathLength: status === "in-progress" ? normalizedProgress : 0,
          opacity: status === "in-progress" ? 1 : 0,
          rotate: spinning ? 360 : -90,
        }}
        transition={spinning ? { rotate: { duration: 1.1, repeat: Infinity, ease: "linear" } } : reduce ? { duration: 0 } : SPRING_LAYOUT}
        style={{ transformOrigin: "12px 12px" }}
      />
      <motion.path
        d="M7.5 12.25 10.5 15.25 16.75 8.75"
        fill="none"
        className="stroke-success-foreground"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: status === "completed" ? 1 : 0, opacity: status === "completed" ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT }}
      />
      <motion.path
        d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: status === "cancelled" ? 1 : 0, opacity: status === "cancelled" ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
      />
    </motion.svg>
  );
}

export function CodePlan({
  items,
  title = "Plan",
  open,
  defaultOpen = true,
  onOpenChange,
  collapseOnComplete = true,
  maxHeight = 248,
  emptyLabel = "No plan set — the agent calls update_plan for multi-step work",
  className,
}: CodePlanProps) {
  const reduce = useReducedMotion() ?? false;
  const baseId = useId();
  const triggerId = `${baseId}-trigger`;
  const contentId = `${baseId}-content`;
  const viewportRef = useRef<HTMLDivElement>(null);
  const previousComplete = useRef(false);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const currentOpen = open ?? internalOpen;
  const completed = items.filter((item) => item.status === "completed").length;
  const allComplete = items.length > 0 && completed === items.length;
  const itemCount = items.length;

  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange, open],
  );

  useEffect(() => {
    if (previousComplete.current && !allComplete) setOpen(true);
    if (!previousComplete.current && allComplete && collapseOnComplete) setOpen(false);
    previousComplete.current = allComplete;
  }, [allComplete, collapseOnComplete, setOpen]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || itemCount === 0) return;
    const frame = requestAnimationFrame(() => {
      if (viewport.scrollHeight <= viewport.clientHeight) return;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [itemCount, reduce]);

  return (
    <section data-slot="code-plan" aria-label="Agent plan" className={cn("w-full overflow-hidden", className)}>
      <button
        id={triggerId}
        type="button"
        aria-expanded={currentOpen}
        aria-controls={contentId}
        onClick={() => setOpen(!currentOpen)}
        className="group focus-visible:ring-ring flex h-11 w-full items-center gap-2.5 px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <h3 className="text-foreground/90 min-w-0 flex-1 truncate text-sm font-medium">{title}</h3>
        {items.length > 0 ? (
          <span className={cn("text-muted-foreground shrink-0 text-xs font-medium tabular-nums", allComplete && "text-success")}>
            <span className="sr-only">
              {completed} of {items.length} steps completed
            </span>
            <span aria-hidden="true" className="inline-flex">
              <CodePlanCount value={String(completed)}>{completed}</CodePlanCount>
              <span>/</span>
              <span>{items.length}</span>
            </span>
          </span>
        ) : null}
        <motion.span
          aria-hidden="true"
          animate={{ rotate: currentOpen ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : SPRING_SWAP}
          className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors"
        >
          <ChevronDown className="size-3.5" />
        </motion.span>
      </button>

      <CodePlanDisclosure id={contentId} role="region" aria-labelledby={triggerId} open={currentOpen}>
        <div ref={viewportRef} className="overflow-y-auto px-2 pb-2" style={{ maxHeight }}>
          {items.length ? (
            <ol aria-live="polite">
              <AnimatePresence initial={false} mode="popLayout">
                {items.map((item) => {
                  const status = item.status ?? "pending";
                  return (
                    <motion.li
                      layout="position"
                      key={item.id}
                      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3 }}
                      transition={reduce ? { duration: 0 } : { opacity: { duration: 0.18, ease: EASE_OUT }, y: SPRING_LAYOUT, layout: SPRING_LAYOUT }}
                      data-status={status}
                      className="flex min-h-9 items-start gap-2.5 rounded-xl px-1.5 py-1.5"
                    >
                      <CodePlanStatusIcon status={status} progress={item.progress} />
                      <span className="sr-only">{STATUS_LABEL[status]}: </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 text-sm leading-5",
                          status === "pending" && "text-muted-foreground/65",
                          status === "in-progress" && "text-foreground",
                          status === "completed" && "text-foreground",
                          status === "cancelled" && "text-error/95",
                        )}
                      >
                        {item.title}
                      </span>
                      {item.detail ? <span className="text-muted-foreground/55 shrink-0 text-xs leading-5">{item.detail}</span> : null}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          ) : (
            <p className="text-muted-foreground px-1.5 py-2 text-sm">{emptyLabel}</p>
          )}
        </div>
      </CodePlanDisclosure>
    </section>
  );
}
