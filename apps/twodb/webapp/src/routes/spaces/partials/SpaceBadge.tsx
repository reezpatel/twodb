import { Box } from "lucide-react";

/** Dumb/presentational — the small space icon tile used in rows and cards. */
export function SpaceBadge() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-outline bg-stone text-ink-muted transition-transform duration-200 group-hover:-rotate-6">
      <Box className="size-3.5" />
    </span>
  );
}
