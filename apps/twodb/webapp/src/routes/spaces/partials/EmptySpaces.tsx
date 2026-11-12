import { Box } from "lucide-react";

/** Dumb/presentational — empty state inside the spaces card. */
export function EmptySpaces() {
  return (
    <div className="px-6 py-12 text-center">
      <Box className="mx-auto size-5 text-ink-muted/60" />
      <p className="mt-2 text-[12px] font-medium text-ink">No spaces</p>
      <p className="mt-1 text-[11px] text-ink-muted">Create a space to scope app resources.</p>
    </div>
  );
}
