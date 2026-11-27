import { cn } from "@twodb/blocks";
import type { ComponentProps, ReactNode } from "react";
import { timeAgoShort } from "../lib/format";

export type TimelineColor = "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "neutral";

export interface TimelineItem {
  color?: TimelineColor;
  content?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  id?: string | number;
  pending?: boolean;
  time?: Date | string;
  title: ReactNode;
}

export interface TimelineProps extends ComponentProps<"ol"> {
  alternate?: boolean;
  items: TimelineItem[];
  loading?: boolean;
  loadingItemsCount?: number;
  size?: "sm" | "md";
  timeFormat?: Intl.DateTimeFormatOptions;
  /** Overrides the bottom padding between entries (e.g. "pb-5"). */
  gapClassName?: string;
  /** Extra classes for the secondary text (description + time), e.g. a smaller size. */
  secondaryClassName?: string;
  /** Show times as "3m ago" / "5d ago" instead of a formatted date. */
  relativeTime?: boolean;
}

const DEFAULT_TIME_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

const sizeClasses = {
  sm: { dotOffset: "h-2", dot: "h-2 w-2", gap: "pb-3", icon: "h-6 w-6 [&>svg]:size-3.5", rail: "w-6", text: "pt-0.5" },
  md: { dotOffset: "h-2.75", dot: "h-2.5 w-2.5", gap: "pb-5", icon: "h-7 w-7 [&>svg]:size-3.5", rail: "w-7", text: "pt-1" },
};
type SizeClasses = (typeof sizeClasses)[keyof typeof sizeClasses];

// Mapped onto the twothing theme tokens (ink / outline / ion-deep / destructive) + emerald & amber used elsewhere in the app.
const dotColors: Record<TimelineColor, string> = {
  primary: "bg-ink",
  secondary: "bg-ink-muted",
  success: "bg-emerald-500",
  danger: "bg-destructive",
  warning: "bg-amber-500",
  info: "bg-ion-deep",
  neutral: "bg-ink-muted",
};

const iconColors: Record<TimelineColor, string> = {
  primary: "border-ink/25 bg-ink/10 text-ink",
  secondary: "border-outline bg-paper text-ink-muted",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  info: "border-ion-deep/30 bg-ion-deep/10 text-ion-deep",
  neutral: "border-outline bg-paper text-ink-muted",
};

const lineClassName = (visible: boolean, dashed: boolean) =>
  cn("w-0.5", visible && (dashed ? "border-s-2 border-dashed border-outline" : "bg-outline forced-colors:bg-[GrayText]"));

const skeletonWidths = ["w-48", "w-64", "w-40", "w-56"];

function TimelineMarker({ item, sizes }: { item: TimelineItem; sizes: SizeClasses }) {
  if (item.pending) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-outline text-ink-muted", sizes.icon)}>
        {item.icon ?? (
          <svg className="animate-spin" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
          </svg>
        )}
      </span>
    );
  }
  const color = item.color ?? "primary";
  if (item.icon) {
    return <span className={cn("flex shrink-0 items-center justify-center rounded-full border", iconColors[color], sizes.icon)}>{item.icon}</span>;
  }
  return <span className={cn("shrink-0 rounded-full forced-colors:bg-[CanvasText]", dotColors[color], sizes.dot)} />;
}

const isShown = (node: ReactNode) => node !== undefined && node !== null && node !== "" && typeof node !== "boolean";

const hasTime = (time: Date | string | undefined): time is Date | string => (typeof time === "string" ? time !== "" : !!time && !Number.isNaN(time.getTime()));

function TimelineTime({ className, time, write }: { className?: string; time: Date | string; write: (time: Date) => string }) {
  if (typeof time === "string") return <span className={className}>{time}</span>;
  return (
    <time className={className} dateTime={time.toISOString()}>
      {write(time)}
    </time>
  );
}

export function Timeline({
  alternate = false,
  className,
  items,
  loading = false,
  loadingItemsCount = 3,
  size = "md",
  timeFormat,
  gapClassName,
  secondaryClassName,
  relativeTime,
  ...props
}: TimelineProps) {
  const sizes = { ...sizeClasses[size], ...(gapClassName ? { gap: gapClassName } : {}) };
  const format = new Intl.DateTimeFormat(undefined, timeFormat ?? DEFAULT_TIME_FORMAT);
  const writeTime = (time: Date) => (relativeTime ? timeAgoShort(time) : format.format(time));

  return (
    <ol aria-busy={loading || undefined} role="list" {...props} className={cn("text-sm", className)} data-orientation="vertical">
      {loading
        ? Array.from({ length: loadingItemsCount }, (_, index) => {
            const isLast = index === loadingItemsCount - 1;
            return (
              <li aria-hidden="true" className="flex gap-3" key={`skeleton-${index}`}>
                <div className={cn("flex shrink-0 flex-col items-center", sizes.rail)}>
                  <div className={cn("shrink-0", sizes.dotOffset)} />
                  <span className={cn("shrink-0 animate-pulse rounded-full bg-stone", sizes.dot)} />
                  <div className={cn("w-0.5 flex-1", !isLast && "bg-stone")} />
                </div>
                <div className={cn("min-w-0 flex-1 space-y-2", sizes.text, !isLast && sizes.gap)}>
                  <div className={cn("h-3.5 max-w-full animate-pulse rounded bg-stone", skeletonWidths[index % skeletonWidths.length])} />
                  <div className="h-3 w-32 max-w-full animate-pulse rounded bg-stone" />
                </div>
              </li>
            );
          })
        : items.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === items.length - 1;
            const isLeft = alternate && index % 2 === 1;
            const hasIconMarker = !!item.icon || !!item.pending;
            const previous = items[index - 1];
            const next = items[index + 1];
            const time = hasTime(item.time) ? item.time : undefined;

            return (
              <li className={cn("flex gap-3", alternate && "md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-4")} key={item.id ?? index}>
                <div aria-hidden="true" className={cn("flex shrink-0 flex-col items-center", sizes.rail, alternate && "md:col-start-2 md:row-start-1")}>
                  <div className={cn("shrink-0", !hasIconMarker && sizes.dotOffset, lineClassName(!isFirst, !!item.pending || !!previous?.pending))} />
                  <TimelineMarker item={item} sizes={sizes} />
                  <div className={cn("flex-1", lineClassName(!isLast, !!item.pending || !!next?.pending))} />
                </div>

                <div
                  className={cn(
                    "min-w-0 flex-1",
                    sizes.text,
                    !isLast && sizes.gap,
                    alternate && (isLeft ? "md:col-start-1 md:row-start-1 md:text-end" : "md:col-start-3 md:row-start-1"),
                  )}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <div className={cn("min-w-0 grow font-medium", item.pending ? "text-ink-muted" : "text-ink")}>
                      {item.title}
                      {item.pending && <span className="sr-only">, pending</span>}
                    </div>
                    {time !== undefined && (
                      <TimelineTime
                        className={cn("shrink-0 text-xs whitespace-nowrap text-ink-muted", alternate && "md:hidden", secondaryClassName)}
                        time={time}
                        write={writeTime}
                      />
                    )}
                  </div>
                  {isShown(item.description) && <div className={cn("mt-0.5 font-light text-ink-muted", secondaryClassName)}>{item.description}</div>}
                  {isShown(item.content) && <div className="mt-2">{item.content}</div>}
                </div>

                {alternate && time !== undefined && (
                  <div className={cn("hidden md:block", sizes.text, isLeft ? "md:col-start-3 md:row-start-1" : "md:col-start-1 md:row-start-1 md:text-end")}>
                    <TimelineTime className="text-xs leading-5 whitespace-nowrap text-ink-muted" time={time} write={writeTime} />
                  </div>
                )}
              </li>
            );
          })}
    </ol>
  );
}

export default Timeline;
