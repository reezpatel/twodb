import { cn } from "@twodb/blocks";
import type { LucideIcon } from "lucide-react";
import { Link } from "../../lib/router";

export function StatTile({ icon: Icon, label, value, to, tone }: { icon: LucideIcon; label: string; value: string; to?: string; tone?: "danger" | "warn" }) {
  const inner = (
    <>
      <div className={cn("grid size-9 place-items-center rounded-xl", tone === "danger" ? "bg-destructive/12 text-destructive" : tone === "warn" ? "bg-amber-500/12 text-amber-600" : "bg-stone text-ink")}>
        <Icon className="size-4" />
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </>
  );
  const cls = "rounded-[18px] border border-outline bg-card p-4 transition";
  return to ? (
    <Link to={to} className={cn(cls, "hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-md")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
