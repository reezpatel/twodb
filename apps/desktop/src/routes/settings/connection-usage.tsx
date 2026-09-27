import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { LlmUsage } from "../../lib/llm";

export function ConnectionUsage({ connectionId }: { connectionId: string }) {
  const usage = useQuery({
    queryKey: ["llm", "usage", connectionId],
    queryFn: () => api<LlmUsage>(`/api/llm/connections/${connectionId}/usage`),
  });

  if (!usage.data || usage.data.requests === 0) return null;

  const { requests, inputTokens, outputTokens, lastUsedAt } = usage.data;
  return (
    <div className="text-muted-foreground text-xs">
      {requests} requests · {inputTokens.toLocaleString()} in / {outputTokens.toLocaleString()} out
      {lastUsedAt && ` · last ${new Date(lastUsedAt).toLocaleString()}`}
    </div>
  );
}
