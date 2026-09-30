import { useQuery } from "@tanstack/react-query";
import { api } from "../../../../lib/api";
import type { LlmUsage } from "../../../../lib/llm";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const TIME_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

function relativeTime(iso: string) {
  const elapsed = Math.round((Date.parse(iso) - Date.now()) / 1000);
  for (const [unit, seconds] of TIME_STEPS) {
    if (Math.abs(elapsed) >= seconds) return relative.format(Math.trunc(elapsed / seconds), unit);
  }
  return "just now";
}

export function ConnectionUsage({ connectionId }: { connectionId: string }) {
  const usage = useQuery({
    queryKey: ["llm", "usage", connectionId],
    queryFn: () => api<LlmUsage>(`/api/llm/connections/${connectionId}/usage`),
  });

  if (!usage.data || usage.data.requests === 0) return null;

  const { requests, inputTokens, outputTokens, lastUsedAt } = usage.data;
  const totalTokens = inputTokens + outputTokens;
  const inputPct = totalTokens > 0 ? (inputTokens / totalTokens) * 100 : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-foreground/80 font-medium tabular-nums">{requests.toLocaleString()} requests</span>
        {lastUsedAt && (
          <span className="text-muted-foreground shrink-0" title={new Date(lastUsedAt).toLocaleString()}>
            last used {relativeTime(lastUsedAt)}
          </span>
        )}
      </div>

      <div
        role="img"
        aria-label={`${compact.format(inputTokens)} input tokens, ${compact.format(outputTokens)} output tokens`}
        className="bg-muted flex h-1.5 overflow-hidden rounded-full"
      >
        <div className="bg-primary h-full" style={{ width: `${inputPct}%` }} />
        <div className="bg-primary/30 h-full flex-1" />
      </div>

      <div className="text-muted-foreground flex items-center gap-3 text-[11px] tabular-nums">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-primary size-1.5 rounded-full" />
          {compact.format(inputTokens)} in
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-primary/30 size-1.5 rounded-full" />
          {compact.format(outputTokens)} out
        </span>
      </div>
    </div>
  );
}
