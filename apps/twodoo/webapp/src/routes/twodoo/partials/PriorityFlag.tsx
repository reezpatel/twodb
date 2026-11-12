import { cn } from "@twodb/blocks";
import type { Priority } from "../../../lib/twoodoo-client";

/** TickTick-style priority flag. Urgent adds a subtle pulse dot. */
export function PriorityFlag(props: { priority: Priority; className?: string }) {
  const { priority } = props;
  if (priority === "none") return null;
  const tone =
    priority === "urgent"
      ? "border-rose-500 text-rose-500"
      : priority === "high"
        ? "border-amber-500 text-amber-500"
        : priority === "medium"
          ? "border-sky-500 text-sky-500"
          : "border-muted-ink/50 text-muted-ink/70";
  const label = priority === "urgent" ? "!!" : priority === "high" ? "!" : priority === "medium" ? "‹" : "";
  return (
    <span
      className={cn("mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-[3px] border text-[8px] font-bold leading-none", tone, props.className)}
      title={`Priority: ${priority}`}
    >
      {label}
    </span>
  );
}
