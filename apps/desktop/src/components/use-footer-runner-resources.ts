import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveRunnerMetrics } from "../routes/code/use-runner-metrics";
import type { RunnerLive } from "../routes/code/use-runner-metrics";
import { useRunners } from "../routes/settings/runners/use-runners";
import { api } from "../lib/api";

/**
 * Bottom-bar runner resources widget: live samples from the shared code ws
 * (resources room) joined with the runner list, plus the user's pinned
 * selection persisted in footer_preference (key runner_resources) — same
 * mechanism as the LLM usage widget.
 */

export const FOOTER_RUNNER_RESOURCES_KEY = "runner_resources";

interface FooterPreference {
  id: string;
  key: string;
  value: Record<string, unknown>;
  updatedAt: string;
}

function parseMetrics(value: Record<string, unknown> | undefined): string[] {
  const metrics = value?.metrics;
  return Array.isArray(metrics) && metrics.every((m) => typeof m === "string") ? (metrics as string[]) : [];
}

export interface FooterRunnerRow {
  id: string;
  name: string;
  online: boolean;
  /** Latest live sample — present only while the runner reports. */
  live: RunnerLive | null;
}

export function useFooterRunnerResources() {
  const queryClient = useQueryClient();
  const prefKey = ["footer-preferences"];
  const runners = useRunners();
  const live = useLiveRunnerMetrics(true);

  const preferences = useQuery({
    queryKey: prefKey,
    queryFn: () => api<FooterPreference[]>("/api/footer-preferences"),
  });

  const selected = parseMetrics(preferences.data?.find((p) => p.key === FOOTER_RUNNER_RESOURCES_KEY)?.value);

  const save = useMutation({
    mutationFn: (metrics: string[]) =>
      api<FooterPreference>(`/api/footer-preferences/${FOOTER_RUNNER_RESOURCES_KEY}`, {
        method: "PUT",
        body: JSON.stringify({ metrics }),
      }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: prefKey }),
  });

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    save.mutate(next);
  };

  const rows: FooterRunnerRow[] = (runners.runners.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    online: r.online,
    live: live.get(r.id) ?? null,
  }));

  return { runners: rows, selected, toggle };
}
