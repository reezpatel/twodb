import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface QuotaRow {
  id: string;
  connectionId: string;
  quotaType: string;
  groupName: string;
  unit: string;
  quotaTotal: number | null;
  quotaUsed: number;
  capturedAt: string;
  resetAt: string | null;
  provider: string;
  connectionName: string;
}

interface FooterPreference {
  id: string;
  key: string;
  value: Record<string, unknown>;
  updatedAt: string;
}

export const FOOTER_LLM_USAGE_KEY = "llm_usage";

function parseMetrics(value: Record<string, unknown> | undefined): string[] {
  const metrics = value?.metrics;
  return Array.isArray(metrics) && metrics.every((m) => typeof m === "string") ? (metrics as string[]) : [];
}

/**
 * Bottom-bar LLM usage widget: live quota snapshots (GET /api/llm/quotas)
 * plus the user's pinned-metric selection persisted in footer_preference.
 */
export function useFooterUsage() {
  const queryClient = useQueryClient();
  const prefKey = ["footer-preferences"];

  const quotas = useQuery({
    queryKey: ["llm", "quotas", "all"],
    queryFn: () => api<QuotaRow[]>("/api/llm/quotas"),
    staleTime: 60_000,
  });

  const preferences = useQuery({
    queryKey: prefKey,
    queryFn: () => api<FooterPreference[]>("/api/footer-preferences"),
  });

  const selected = parseMetrics(preferences.data?.find((p) => p.key === FOOTER_LLM_USAGE_KEY)?.value);

  const save = useMutation({
    mutationFn: (metrics: string[]) =>
      api<FooterPreference>(`/api/footer-preferences/${FOOTER_LLM_USAGE_KEY}`, {
        method: "PUT",
        body: JSON.stringify({ metrics }),
      }),
    onMutate: async (metrics) => {
      await queryClient.cancelQueries({ queryKey: prefKey });
      const previous = queryClient.getQueryData<FooterPreference[]>(prefKey);
      queryClient.setQueryData<FooterPreference[]>(prefKey, (rows) => {
        const rest = (rows ?? []).filter((r) => r.key !== FOOTER_LLM_USAGE_KEY);
        return [...rest, { id: FOOTER_LLM_USAGE_KEY, key: FOOTER_LLM_USAGE_KEY, value: { metrics }, updatedAt: new Date().toISOString() }];
      });
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(prefKey, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: prefKey }),
  });

  const toggle = (metric: string) => {
    const next = selected.includes(metric) ? selected.filter((m) => m !== metric) : [...selected, metric];
    save.mutate(next);
  };

  const refreshQuotas = useMutation({
    mutationFn: async () => {
      const connections = await api<{ id: string; name: string }[]>("/api/llm/connections");
      const results = await Promise.allSettled(
        connections.map(async (connection) => {
          try {
            await api<{ error?: string; detail?: string }>(`/api/llm/connections/${connection.id}/refresh-quotas`, { method: "POST", body: "{}" });
            return null;
          } catch (e) {
            const message = (e as Error).message;
            if (message.includes("quota_refresh_not_supported")) return null; // provider has no quota API — not a failure
            return `${connection.name}: ${message.slice(0, 140)}`;
          }
        }),
      );
      const errors = results.map((r) => (r.status === "fulfilled" ? r.value : `request failed: ${r.reason?.message ?? "unknown"}`)).filter((v): v is string => v !== null);
      return { refreshed: results.length - errors.length, failed: errors.length, errors };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["llm", "quotas"] });
    },
  });

  // Auto-refresh quota snapshots every 15 minutes while the app is open.
  const refreshQuotasRef = useRef(refreshQuotas);
  refreshQuotasRef.current = refreshQuotas;
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!refreshQuotasRef.current.isPending) refreshQuotasRef.current.mutate();
    }, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return { quotas: quotas.data ?? [], quotasLoading: quotas.isPending, selected, toggle, saving: save.isPending, refreshQuotas };
}
