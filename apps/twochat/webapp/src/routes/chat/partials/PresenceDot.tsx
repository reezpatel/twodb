import { cn } from "@twodb/blocks";

export type PresenceStatus = "online" | "bot" | "offline";

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: "bg-emerald-500",
  bot: "bg-primary",
  offline: "bg-muted-foreground/50",
};

/** Accessible presence marker overlaid on a direct-message avatar. */
export function PresenceDot({ status }: { status: PresenceStatus }) {
  const label = status === "bot" ? "Agent" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      aria-label={label}
      className={cn("inline-block size-3 rounded-full border-2 border-card", STATUS_COLORS[status])}
      title={label}
    />
  );
}
