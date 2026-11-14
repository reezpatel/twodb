import { useState } from "react";
import { cn } from "../../../lib/cn.js";

/** Usage stat row under the composer (legacy code-chat-usage). */
export function ChatUsage({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="chat-usage" className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-ink-muted", className)} {...props} />;
}

export function ChatUsageStat({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="chat-usage-stat" className={cn("font-mono text-xs tabular-nums", className)} {...props} />;
}

const RING_VIEWBOX = 32;
const RING_CENTER = RING_VIEWBOX / 2;
const RING_RADIUS = 13;
const RING_STROKE = 3;

/** Context-window ring: 0–100% used; hue shifts past warn/danger. Hover/focus
 *  opens a breakdown popup (what fills the window). */
export function ChatUsageContext({ percent, label, breakdown, warnAt = 80, dangerAt = 95, className, ...props }: React.ComponentProps<"span"> & {
  percent: number | null;
  label: string;
  breakdown?: Array<{ label: string; value: string }>;
  warnAt?: number;
  dangerAt?: number;
}) {
  const [open, setOpen] = useState(false);
  const fraction = percent === null ? 0 : Math.min(1, Math.max(0, percent / 100));
  const tone = percent === null ? "" : percent >= dangerAt ? "text-destructive" : percent >= warnAt ? "text-warning" : "";
  const hasBreakdown = Boolean(breakdown?.length);
  return (
    <span
      data-slot="chat-usage-context"
      role="img"
      aria-label={percent === null ? `Context ${label}` : `Context window ${Math.round(percent)}% used, ${label}`}
      className={cn("relative flex items-center gap-1.5 px-0.5 py-0.5", hasBreakdown && "cursor-default", className)}
      onMouseEnter={hasBreakdown ? () => setOpen(true) : undefined}
      onMouseLeave={hasBreakdown ? () => setOpen(false) : undefined}
      onFocus={hasBreakdown ? () => setOpen(true) : undefined}
      onBlur={hasBreakdown ? () => setOpen(false) : undefined}
      tabIndex={hasBreakdown ? 0 : undefined}
      {...props}
    >
      {open && breakdown?.length ? (
        <span
          data-slot="chat-usage-context-popup"
          role="tooltip"
          className="absolute bottom-full left-0 z-30 mb-1.5 min-w-44 rounded-md border border-outline bg-surface px-2.5 py-1.5 shadow-lg"
        >
          {breakdown.map((item, i) => (
            <span key={i} className="flex items-center justify-between gap-4 py-0.5 text-[11px]">
              <span className="text-ink-muted">{item.label}</span>
              <span className="font-mono tabular-nums">{item.value}</span>
            </span>
          ))}
        </span>
      ) : null}
      <svg aria-hidden="true" className={cn("size-4 -rotate-90", tone)} viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}>
        <circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={RING_STROKE} />
        <circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${fraction} ${1 - fraction}`}
          pathLength={1}
        />
      </svg>
      <span className="font-mono text-xs tabular-nums">{label}</span>
    </span>
  );
}

export function ChatUsageSpacer() {
  return <span data-slot="chat-usage-spacer" className="flex-1" aria-hidden="true" />;
}
