import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { subscribeResources } from "./code-room-ws";
import { api } from "@/lib/api";

/**
 * Live runner resource metrics for the whole org — rides the shared code ws
 * (`resources:subscribe`); every 10s each online runner pushes a sample.
 * Also exposes persisted history (10-min windows, 30 days) for charts.
 */

export interface GpuLive {
  vendor: string;
  index: number;
  name: string;
  utilization: number;
  memoryUsed: number;
  memoryTotal: number;
  temperature: number | null;
}

export interface DiskLive {
  path: string;
  used: number;
  total: number;
  inodeUsedRatio: number | null;
  error?: string;
}

export interface MetricsSample {
  at: string;
  cpu: { busy: number; load1: number; cores: number; perCore: number[] };
  memory: { used: number; total: number };
  gpus: GpuLive[];
  disks: DiskLive[];
}

export interface RunnerLive {
  runnerId: string;
  at: string;
  metrics: MetricsSample;
}

/** Live samples keyed by runnerId — updates every 10s while subscribed. */
export function useLiveRunnerMetrics(enabled = true) {
  const [live, setLive] = useState<Map<string, RunnerLive>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    return subscribeResources((f) => {
      const metrics = f.metrics as MetricsSample;
      if (!metrics) return;
      setLive((prev) => {
        const next = new Map(prev);
        next.set(f.runnerId, { runnerId: f.runnerId, at: f.at, metrics });
        return next;
      });
    });
  }, [enabled]);

  return live;
}

/** Persisted history for one runner (chart data). */
export function useRunnerMetricsHistory(runnerId: string | null, hours = 720) {
  return useQuery({
    queryKey: ["runners", "metrics", runnerId, hours],
    queryFn: () => api<MetricsSample[]>(`/api/runners/${runnerId}/metrics?hours=${hours}`),
    enabled: runnerId !== null,
  });
}

/** Tell the shared ws we want resources frames (idempotent per consumer). */
export function useResourcesRoom(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    return subscribeResources();
  }, [enabled]);
}
