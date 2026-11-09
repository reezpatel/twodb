import { useEffect, useMemo, useState } from "react";
import { fmtTokens } from "@/lib/format-tokens";
import { useRunners } from "@/routes/settings/runners/use-runners";
import { useLiveRunnerMetrics } from "../use-runner-metrics";
import { useSessionDirectory } from "./use-session-directory";
import type { SessionStats } from "./use-chat-panel";

export type FooterMetricKind = "cpu" | "memory" | "gpu" | "disk";

type FooterResourceConfig = Record<string, FooterMetricKind[]>;

const STORAGE_KEY = "twodb:footer-resources";
const ALL_KINDS: FooterMetricKind[] = ["cpu", "memory", "gpu", "disk"];

function loadConfig(): FooterResourceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FooterResourceConfig) : {};
  } catch {
    return {};
  }
}

function fmtBytes(n: number) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(0)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(0)}G`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return `${Math.round(n / 1e3)}k`;
}

export interface FooterMetric {
  key: string;
  label: string;
  percent: number;
  value: string;
}

export interface FooterRunnerResources {
  id: string;
  name: string;
  metrics: FooterMetric[];
  toggles: { kind: FooterMetricKind; label: string; on: boolean }[];
}

/**
 * Everything the chat footer's status strip shows, already computed: token
 * usage and context for the session, and live CPU / memory / GPU / disk for
 * the machine hosting the session's directory. Which metric kinds show is
 * user-selectable and persisted per runner to localStorage.
 */
export function useChatFooterStatus(stats: SessionStats, contextWindow: number | null) {
  const runners = useRunners();
  const live = useLiveRunnerMetrics(true);
  const { runnerId } = useSessionDirectory();
  const [config, setConfig] = useState<FooterResourceConfig>(() => loadConfig());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const cachePercent = stats.inputTokens > 0 ? Math.round((stats.cachedTokens / stats.inputTokens) * 100) : null;
  const contextPercent = contextWindow && contextWindow > 0 ? Math.min(100, Math.round((stats.contextTokens / contextWindow) * 100)) : null;

  const usage = {
    input: fmtTokens(stats.inputTokens),
    output: fmtTokens(stats.outputTokens),
    cache: cachePercent !== null ? `${cachePercent}%` : "—",
    speed: stats.tokPerSec !== null ? `${stats.tokPerSec} tok/s` : "—",
    contextPercent,
    contextLabel: `${fmtTokens(stats.contextTokens)}${contextWindow ? ` / ${fmtTokens(contextWindow)}` : ""}`,
  };

  const machines = useMemo<FooterRunnerResources[]>(() => {
    if (!runnerId) return [];
    const sample = live.get(runnerId);
    const known = runners.runners.data?.find((r) => r.id === runnerId);
    if (!sample || !known) return [];

    const kinds = config[runnerId] ?? ALL_KINDS;
    const { cpu, memory, gpus, disks } = sample.metrics;
    const metrics: FooterMetric[] = [];
    if (kinds.includes("cpu")) metrics.push({ key: "cpu", label: "cpu", percent: cpu.busy * 100, value: `${Math.round(cpu.busy * 100)}%` });
    if (kinds.includes("memory")) {
      metrics.push({
        key: "mem",
        label: "mem",
        percent: (memory.used / Math.max(1, memory.total)) * 100,
        value: `${fmtBytes(memory.used)}/${fmtBytes(memory.total)}`,
      });
    }
    if (kinds.includes("gpu")) {
      for (const g of gpus) {
        metrics.push({
          key: `gpu${g.index}`,
          label: `gpu${g.index}`,
          percent: g.utilization,
          value: `${Math.round(g.utilization)}%${g.temperature !== null ? ` ${g.temperature}°` : ""}`,
        });
      }
    }
    if (kinds.includes("disk")) {
      for (const d of disks.filter((disk) => !disk.error)) {
        metrics.push({ key: d.path, label: d.path, percent: (d.used / Math.max(1, d.total)) * 100, value: `${fmtBytes(d.used)}/${fmtBytes(d.total)}` });
      }
    }

    const toggles: FooterRunnerResources["toggles"] = [
      { kind: "cpu", label: "cpu", on: kinds.includes("cpu") },
      { kind: "memory", label: "mem", on: kinds.includes("memory") },
    ];
    if (gpus.length > 0) toggles.push({ kind: "gpu", label: `gpu×${gpus.length}`, on: kinds.includes("gpu") });
    if (disks.length > 0) toggles.push({ kind: "disk", label: `disk×${disks.length}`, on: kinds.includes("disk") });

    return [{ id: runnerId, name: known.name ?? runnerId.slice(0, 8), metrics, toggles }];
  }, [config, live, runnerId, runners.runners.data]);

  const toggleKind = (id: string, kind: FooterMetricKind) => {
    setConfig((prev) => {
      const current = prev[id] ?? ALL_KINDS;
      return { ...prev, [id]: current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind] };
    });
  };

  return {
    usage,
    machines,
    toggleKind,
    resourcesEmptyText: runnerId ? "machine offline" : "no machine for this session",
    resourcesSettingsEmptyText: runnerId ? "This session's machine is offline." : "This session has no directory, so no machine to show.",
  };
}
