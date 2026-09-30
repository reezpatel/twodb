import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { api } from "../../../../lib/api";
import { cn } from "@/lib/utils";

export interface LlmQuota {
  id: string;
  connectionId: string;
  quotaType: string;
  groupName: string;
  unit: string;
  quotaTotal: number | null;
  quotaUsed: number;
  capturedAt: string;
  resetAt: string | null;
}

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

const BLOCKS = 8;
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 });
const UNIT_LABELS: Record<string, string> = { credits: "Cr." };
const UNIT_PREFIXES: Record<string, string> = { usd: "$" };
const TYPE_LABELS: Record<string, string> = { weekly: "W", monthly: "M" };
const TYPE_ORDER: Record<string, number> = { "5h": 0, weekly: 1, monthly: 2 };
const SHOW_MONTHLY_QUOTA = false;

function quotaTone(pct: number) {
  return pct > 80 ? "bg-destructive" : pct >= 50 ? "bg-warning" : "bg-success";
}

function QuotaBlocks({ pct, quotaType }: { pct: number; quotaType: string }) {
  const filled = Math.round((pct / 100) * BLOCKS);
  const tone = quotaTone(pct);
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`${quotaType} quota ${pct}% used`}>
      {Array.from({ length: BLOCKS }, (_, i) => (
        <span key={i} className={cn("h-3.5 w-2.5 rounded-[1px]", i < filled ? tone : "bg-border")} />
      ))}
    </div>
  );
}

export function ConnectionQuotas({ connectionId }: { connectionId: string }) {
  const quotas = useQuery({
    queryKey: ["llm", "quotas", connectionId],
    queryFn: () => api<LlmQuota[]>(`/api/llm/connections/${connectionId}/quotas`),
  });

  const rows = [...(quotas.data ?? [])]
    .filter((q) => SHOW_MONTHLY_QUOTA || q.quotaType !== "monthly")
    .sort((a, b) => (TYPE_ORDER[a.quotaType] ?? 99) - (TYPE_ORDER[b.quotaType] ?? 99));
  if (rows.length === 0) return null;

  return (
    <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-x-4">
      {rows.map((q) => {
        const pct = q.quotaTotal && q.quotaTotal > 0 ? Math.min(100, Math.round((q.quotaUsed / q.quotaTotal) * 100)) : null;
        const countdown = until(q.resetAt);
        return (
          <div key={q.id} className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span className="text-muted-foreground shrink-0 text-sm font-medium" title={q.quotaType}>
              {TYPE_LABELS[q.quotaType] ?? q.quotaType.charAt(0).toUpperCase() + q.quotaType.slice(1)}
            </span>
            {pct !== null && <QuotaBlocks pct={pct} quotaType={q.quotaType} />}
            <span
              className={cn(
                "truncate text-sm tabular-nums",
                pct !== null && pct > 80 ? "text-destructive font-medium" : pct !== null && pct >= 50 ? "text-warning" : "text-muted-foreground",
              )}
            >
              {q.unit === "percent" ? (
                `${q.quotaUsed}%`
              ) : q.unit in UNIT_PREFIXES ? (
                <>
                  {UNIT_PREFIXES[q.unit]}
                  {compact.format(q.quotaUsed)}
                  {q.quotaTotal ? `/${UNIT_PREFIXES[q.unit]}${compact.format(q.quotaTotal)}` : ""}
                </>
              ) : (
                <>
                  {compact.format(q.quotaUsed)}
                  {q.quotaTotal ? `/${compact.format(q.quotaTotal)}` : ""} {UNIT_LABELS[q.unit] ?? q.unit}
                </>
              )}
            </span>
            {countdown && (
              <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-sm tabular-nums">
                <Clock size={13} />
                {countdown}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
