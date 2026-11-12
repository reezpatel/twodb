import { KeyRound } from "lucide-react";

/** Dumb/presentational — empty state inside the keys card. */
export function EmptyKeys() {
  return (
    <div className="px-6 py-12 text-center">
      <KeyRound className="mx-auto size-5 text-ink-muted/60" />
      <p className="mt-2 text-[12px] font-medium text-ink">No API keys</p>
      <p className="mt-1 text-[11px] text-ink-muted">Create a key to call the gateway from scripts and CLIs.</p>
    </div>
  );
}
