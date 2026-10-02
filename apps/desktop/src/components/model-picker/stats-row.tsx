import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface StatsRowStats {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  contextTokens: number;
  tokPerSec: number | null;
}

export function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function StatsRow({ stats, contextWindow, children }: { stats: StatsRowStats; contextWindow: number | null; children?: ReactNode }) {
  const cachePct = stats.inputTokens > 0 ? Math.round((stats.cachedTokens / stats.inputTokens) * 100) : null;
  const ctxPct = contextWindow && contextWindow > 0 ? Math.min(100, Math.round((stats.contextTokens / contextWindow) * 100)) : null;

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs">
      <span title="Input tokens (incl. cached)">↑ {fmtTokens(stats.inputTokens)}</span>
      <span title="Output tokens">↓ {fmtTokens(stats.outputTokens)}</span>
      <span title="Cache hit — cached input / total input">⚡ {cachePct !== null ? `${cachePct}%` : "—"}</span>
      <span title="Generation speed">{stats.tokPerSec !== null ? `${stats.tokPerSec} tok/s` : "—"}</span>
      <span className="flex min-w-40 items-center gap-2" title="Context consumed vs the model's context window">
        <Progress
          value={ctxPct ?? 0}
          className={cn(
            "h-1.5 w-24",
            ctxPct !== null && ctxPct >= 95
              ? "[&>[data-slot=indicator]]:bg-destructive"
              : ctxPct !== null && ctxPct >= 80
                ? "[&>[data-slot=indicator]]:bg-warning"
                : "",
          )}
        />
        <span>
          {fmtTokens(stats.contextTokens)}
          {contextWindow ? ` / ${fmtTokens(contextWindow)}` : ""}
        </span>
      </span>

      <div className="flex-1"></div>

      {children}
    </div>
  );
}
