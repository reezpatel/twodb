import { cn } from "@twodb/blocks";
import { QrCode } from "lucide-react";

/** Monospace label-code pill, e.g. [▣ K7Q-M2X]. */
export function CodeChip({ code, className, muted }: { code: string | null | undefined; className?: string; muted?: boolean }) {
  if (!code) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider",
        muted ? "border-outline text-ink-muted" : "border-ink/15 bg-ink/[0.04] text-ink",
        className,
      )}
    >
      <QrCode className="size-3 opacity-60" />
      {code}
    </span>
  );
}
