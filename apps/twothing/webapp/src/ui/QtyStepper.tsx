import { cn } from "@twodb/blocks";
import { Minus, Plus } from "lucide-react";
import { formatQty } from "../lib/format";

/** −  12 pcs  + — big touch targets, used in lists, detail and the scanner. */
export function QtyStepper({
  quantity,
  unit,
  low,
  onDelta,
  size = "md",
  className,
}: {
  quantity: number;
  unit: string;
  low?: boolean;
  onDelta: (d: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const btn = cn(
    "grid place-items-center rounded-full border border-outline bg-paper text-ink transition active:scale-90 hover:bg-stone disabled:opacity-40",
    size === "sm" ? "size-7" : size === "lg" ? "size-12" : "size-9",
  );
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Remove one" className={btn} disabled={quantity <= 0} onClick={() => onDelta(-1)}>
        <Minus className={size === "lg" ? "size-5" : "size-3.5"} />
      </button>
      <div className={cn("min-w-14 text-center leading-tight", size === "lg" && "min-w-20")}>
        <div className={cn("font-semibold tabular-nums", size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base", low && "text-destructive")}>{formatQty(quantity)}</div>
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">{unit}</div>
      </div>
      <button type="button" aria-label="Add one" className={btn} onClick={() => onDelta(1)}>
        <Plus className={size === "lg" ? "size-5" : "size-3.5"} />
      </button>
    </div>
  );
}
