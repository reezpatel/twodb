import { Bot, Loader2, RotateCw } from "lucide-react";
import { useState } from "react";
import { ProviderLogo } from "./provider-logo";
import { useFooterUsage, type QuotaRow } from "./use-footer-usage";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 });

const TYPE_LABELS: Record<string, string> = {
  "5h": "5h",
  weekly: "Weekly",
  "weekly-opus": "Weekly Opus",
  "weekly-sonnet": "Weekly Sonnet",
  monthly: "Monthly",
  daily: "Daily",
  credits: "Credits",
  added: "Added",
  extra: "Extra",
};

const TYPE_ORDER: Record<string, number> = { "5h": 0, weekly: 1, "weekly-opus": 1, "weekly-sonnet": 1, daily: 2, monthly: 3, extra: 4, credits: 5, added: 6 };

const metricId = (q: QuotaRow) => `${q.connectionId}:${q.groupName}:${q.quotaType}`;

function until(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function quotaValue(q: QuotaRow): string {
  if (q.unit === "percent") return `${Math.round(q.quotaUsed)}%`;
  if (q.unit === "usd") {
    const remaining = Math.max(0, (q.quotaTotal ?? 0) - q.quotaUsed);
    return `$${remaining.toFixed(2)}`;
  }
  const total = q.quotaTotal ? `/${compact.format(q.quotaTotal)}` : "";
  return `${compact.format(q.quotaUsed)}${total}`;
}

function quotaTone(q: QuotaRow): string {
  if (q.unit === "usd") return "text-muted-foreground";
  const pct = q.quotaTotal && q.quotaTotal > 0 ? (q.quotaUsed / q.quotaTotal) * 100 : q.unit === "percent" ? q.quotaUsed : null;
  if (pct === null) return "text-muted-foreground";
  if (pct > 80) return "text-destructive";
  if (pct >= 50) return "text-warning";
  return "text-muted-foreground";
}

function MetricChip({ q }: { q: QuotaRow }) {
  const countdown = until(q.resetAt);
  return (
    <span className="flex items-center gap-1.5" title={`${q.connectionName} — ${TYPE_LABELS[q.quotaType] ?? q.quotaType}${countdown ? ` · resets in ${countdown}` : ""}`}>
      <ProviderLogo provider={q.provider} className="size-3" />
      <span className="text-muted-foreground">{TYPE_LABELS[q.quotaType] ?? q.quotaType}</span>
      <span className={cn("tabular-nums", quotaTone(q))}>{quotaValue(q)}</span>
    </span>
  );
}

export function FooterUsage() {
  const { quotas, quotasLoading, selected, toggle, refreshQuotas } = useFooterUsage();
  const [open, setOpen] = useState(false);

  const byConnection = new Map<string, { name: string; provider: string; rows: QuotaRow[] }>();
  for (const q of quotas) {
    const entry = byConnection.get(q.connectionId) ?? { name: q.connectionName, provider: q.provider, rows: [] };
    entry.rows.push(q);
    byConnection.set(q.connectionId, entry);
  }
  const groups = [...byConnection.values()].map((g) => ({ ...g, rows: [...g.rows].sort((a, b) => (TYPE_ORDER[a.quotaType] ?? 99) - (TYPE_ORDER[b.quotaType] ?? 99)) }));

  const selectedQuotas = selected.map((id) => quotas.find((q) => metricId(q) === id)).filter((q): q is QuotaRow => q !== undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="LLM usage"
          className="text-muted-foreground hover:text-foreground flex h-6 items-center gap-2 rounded px-1 transition-colors outline-none"
        >
          <Bot size={13} />
          {selectedQuotas.map((q) => (
            <MetricChip key={metricId(q)} q={q} />
          ))}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium">LLM usage</span>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground pr-1 text-[11px] tabular-nums">{selected.length} pinned</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Refresh quotas"
              disabled={refreshQuotas.isPending}
              onClick={() => refreshQuotas.mutate()}
            >
              {refreshQuotas.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
            </Button>
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {refreshQuotas.data?.failed ? (
            <div className="text-destructive border-b px-3 py-1.5 text-[11px] leading-snug">
              {refreshQuotas.data.failed} refresh failed — {refreshQuotas.data.errors.join("; ")}
            </div>
          ) : null}
          {quotasLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            </div>
          ) : groups.length === 0 ? (
            <p className="text-muted-foreground px-3 py-4 text-xs">
              No quota snapshots yet. Add an LLM connection with a subscription plan (Claude, Codex, z.ai…) and refresh quotas.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.name + group.rows[0]?.connectionId} className="mb-1 last:mb-0">
                <div className="text-muted-foreground flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium">
                  <ProviderLogo provider={group.provider} className="size-3" />
                  <span className="truncate">{group.name}</span>
                </div>
                {group.rows.map((q) => {
                  const id = metricId(q);
                  const checked = selected.includes(id);
                  return (
                    <label
                      key={q.id}
                      className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        toggle(id);
                      }}
                    >
                      <Checkbox checked={checked} tabIndex={-1} />
                      <span className="text-muted-foreground min-w-14 shrink-0">{TYPE_LABELS[q.quotaType] ?? q.quotaType}</span>
                      <span className={cn("ml-auto tabular-nums", quotaTone(q))}>{quotaValue(q)}</span>
                      {until(q.resetAt) && <span className="text-muted-foreground/70 w-8 shrink-0 text-right tabular-nums">{until(q.resetAt)}</span>}
                    </label>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
