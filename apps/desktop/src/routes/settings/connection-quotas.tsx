import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  if (ms <= 0) return "resetting…";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `resets in ${minutes}m`;
  return `resets in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function ConnectionQuotas({ connectionId, provider }: { connectionId: string; provider: string }) {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["llm", "quotas", connectionId] });

  const quotas = useQuery({
    queryKey: ["llm", "quotas", connectionId],
    queryFn: () => api<LlmQuota[]>(`/api/llm/connections/${connectionId}/quotas`),
  });

  const refresh = useMutation({
    mutationFn: () => api(`/api/llm/connections/${connectionId}/refresh-quotas`, { method: "POST", body: "{}" }),
    onSuccess: invalidate,
  });

  const rows = quotas.data ?? [];
  if (rows.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {rows.map((q) => {
        const pct = q.quotaTotal && q.quotaTotal > 0 ? Math.min(100, Math.round((q.quotaUsed / q.quotaTotal) * 100)) : null;
        const countdown = until(q.resetAt);
        return (
          <div key={q.id} className="flex items-center gap-2">
            <span className="text-muted-foreground w-12 shrink-0 text-[11px] font-medium">{q.quotaType}</span>
            {pct !== null && <Progress value={pct} className="h-1.5 w-20 shrink-0" aria-label={`${q.quotaType} quota ${pct}%`} />}
            <span
              className={cn(
                "text-[11px]",
                pct !== null && pct >= 90 ? "text-destructive font-medium" : pct !== null && pct >= 70 ? "text-warning" : "text-muted-foreground",
              )}
            >
              {q.quotaUsed}
              {q.quotaTotal ? `/${q.quotaTotal}` : ""} {q.unit}
              {countdown ? ` · ${countdown}` : ""}
            </span>
          </div>
        );
      })}
      {provider === "claude-code" && (
        <Button variant="ghost" size="sm" className="h-5 w-fit px-1.5 text-[11px]" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
          <Gauge size={11} />
          {refresh.isPending ? "checking…" : "refresh quotas"}
        </Button>
      )}
    </div>
  );
}
