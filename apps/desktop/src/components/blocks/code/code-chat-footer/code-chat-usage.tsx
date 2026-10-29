import { useState, type ComponentProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function CodeChatUsage({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="code-chat-usage" className={cn("text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm", className)} {...props} />
  );
}

export function CodeChatUsageStat({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="code-chat-usage-stat" className={cn("tabular-nums text-xs", className)} {...props} />;
}

const RING_VIEWBOX = 32;
const RING_CENTER = RING_VIEWBOX / 2;
const RING_RADIUS = 13;
const RING_STROKE = 3;
const RING_SPRING = { type: "spring" as const, bounce: 0.1, duration: 0.25 };
const POPUP_EASE = [0.23, 1, 0.32, 1] as const;

export type CodeChatUsageBreakdownItem = {
  label: string;
  value: string;
};

type CodeChatUsageContextProps = Omit<ComponentProps<"span">, "children"> & {
  /** 0–100, or null when the context window is unknown. */
  percent: number | null;
  label: string;
  /** Optional split of what fills the window. Shown in a popup on hover or focus. */
  breakdown?: CodeChatUsageBreakdownItem[];
  warnAt?: number;
  dangerAt?: number;
};

/**
 * Context-window ring. Crossing a threshold changes the hue, never the size:
 * growing the ring at the warning point would read as progress.
 */
export function CodeChatUsageContext({ percent, label, breakdown, warnAt = 80, dangerAt = 95, className, ...props }: CodeChatUsageContextProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const fraction = percent === null ? 0 : Math.min(1, Math.max(0, percent / 100));
  const tone = percent === null ? "" : percent >= dangerAt ? "text-destructive" : percent >= warnAt ? "text-warning" : "";
  const hasBreakdown = Boolean(breakdown?.length);
  const description = percent === null ? `Context ${label}` : `Context window ${Math.round(percent)}% used, ${label}`;

  const ring = (
    <>
      <svg aria-hidden="true" className={cn("size-4 -rotate-90", tone)} viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}>
        <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={RING_STROKE} />
        <motion.circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          pathLength={1}
          initial={false}
          animate={{ strokeDasharray: `${fraction} ${1 - fraction}` }}
          transition={reduce ? { duration: 0 } : RING_SPRING}
        />
      </svg>
      <span className="tabular-nums text-xs">{label}</span>
    </>
  );

  return (
    <span data-slot="code-chat-usage-context" className={cn("relative inline-flex", className)} {...props}>
      {hasBreakdown ? (
        <button
          type="button"
          aria-label={description}
          aria-expanded={open}
          className="hover:text-foreground focus-visible:ring-ring flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors outline-none focus-visible:ring-2"
          onClick={() => setOpen((cur) => !cur)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          {ring}
        </button>
      ) : (
        <span role="img" aria-label={description} className="flex items-center gap-1.5 px-1 py-0.5">
          {ring}
        </span>
      )}
      <AnimatePresence>
        {open && hasBreakdown ? (
          <motion.ul
            role="tooltip"
            className="border-border bg-popover text-popover-foreground absolute bottom-full left-0 z-50 mb-1.5 w-56 list-none space-y-1 rounded-xl border p-2.5 shadow-lg"
            style={{ transformOrigin: "bottom left" }}
            initial={reduce ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.96, y: 4 }}
            transition={reduce ? { duration: 0 } : { duration: 0.18, ease: POPUP_EASE }}
          >
            {breakdown?.map((item) => (
              <li key={item.label} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground truncate">{item.label}</span>
                <span className="text-foreground shrink-0 tabular-nums">{item.value}</span>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

/** Pushes whatever follows (usually the model picker) to the right edge. */
export function CodeChatUsageSpacer() {
  return <span data-slot="code-chat-usage-spacer" className="flex-1" aria-hidden="true" />;
}
