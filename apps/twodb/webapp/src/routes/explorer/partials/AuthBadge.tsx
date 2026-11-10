import { Chip, cn, type ChipTone } from "@twodb/blocks";

/** Normalized auth scheme → design-system chip tone. */
const AUTH_TONES: Record<string, ChipTone> = {
  session: "info",
  apikey: "warning",
  public: "success",
};

/** Display label per scheme — "apiKey" renders as "Key", etc. */
const AUTH_LABELS: Record<string, string> = {
  session: "Session",
  apikey: "Key",
  public: "Public",
};

/**
 * Endpoint auth-scheme cell: one blocks Chip per accepted scheme, so a
 * compound value like "session-or-apiKey" renders as two chips
 * [session] [apiKey] rather than one long badge.
 * Dumb/presentational only.
 */
export function AuthBadge({ auth, className }: { auth: string; className?: string }) {
  // Split compound schemes: "session-or-apiKey" → ["session", "apiKey"]
  const schemes = auth
    .split(/[-_\s]+/)
    .map((s) => s.trim().toLowerCase().replace(/[^a-z]/g, ""))
    .filter((s) => s && s !== "or" && s in AUTH_TONES);

  if (schemes.length === 0) {
    return <span className={cn("text-[13px] text-ink-muted", className)}>{auth || "none"}</span>;
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {schemes.map((scheme) => (
        <Chip
          key={scheme}
          tone={AUTH_TONES[scheme]}
          dot={false}
          className="pointer-events-none cursor-default rounded-md px-2 py-0.5 text-[11px] leading-4"
        >
          {AUTH_LABELS[scheme]}
        </Chip>
      ))}
    </span>
  );
}
