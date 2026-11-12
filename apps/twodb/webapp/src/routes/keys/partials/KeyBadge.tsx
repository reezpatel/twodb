import { KeyRound } from "lucide-react";
import { cn } from "@twodb/blocks";

/** Dumb/presentational — the small key icon tile used in rows and cards. */
export function KeyBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-lg border border-outline bg-stone text-ink-muted transition-transform duration-200 group-hover:-rotate-6",
        className,
      )}
    >
      <KeyRound className="size-3.5" />
    </span>
  );
}
