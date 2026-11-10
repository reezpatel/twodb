import { cn } from "@twodb/blocks";
import type { ChipTone } from "@twodb/blocks";

/** Method → design-system tone (blocks' Isometric-Lab palette). */
const METHOD_TONES: Record<string, ChipTone> = {
  GET: "success",
  POST: "info",
  PATCH: "warning",
  PUT: "warning",
  DELETE: "danger",
};

const TONE_CLASS: Record<ChipTone, string> = {
  info: "border-info/40 bg-info/10 text-info",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
};

/** HTTP method badge, tone-colored from the design system (not hex literals). */
export function MethodBadge({ method, className }: { method: string; className?: string }) {
  const tone = METHOD_TONES[method] ?? "info";
  return (
    <span
      className={cn(
        "inline-flex min-w-12 items-center justify-center rounded-md border px-2 py-1.5 font-mono text-[11px] font-bold uppercase",
        TONE_CLASS[tone],
        className,
      )}
    >
      {method}
    </span>
  );
}
