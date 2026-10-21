import { useEffect, useMemo, useRef, useState } from "react";
import { Cpu, HardDrive, MonitorCog, X } from "lucide-react";
import { useLiveRunnerMetrics } from "../../use-runner-metrics";
import { useRunners } from "@/routes/settings/runners/use-runners";
import { cn } from "@/lib/utils";

/**
 * Footer resources strip: live CPU / memory / GPU / disk chips for the org's
 * runners. What shows is user-selectable (persisted to localStorage) — the
 * ⚙ popover toggles metric kinds per runner.
 */

export type FooterMetricKind = "cpu" | "memory" | "gpu" | "disk";

interface FooterResourceConfig {
  /** runnerId → enabled metric kinds. */
  [runnerId: string]: FooterMetricKind[];
}

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

/** One live chip: label + mini bar + value. */
function MetricChip({ label, pct, value, warn = 85, danger = 95 }: { label: string; pct: number | null; value: string; warn?: number; danger?: number }) {
  return (
    <span className="flex items-center gap-1.5" title={`${label} ${value}${pct !== null ? ` (${Math.round(pct)}%)` : ""}`}>
      <span className="truncate">{label}</span>
      <span className="relative h-1 w-10 overflow-hidden rounded-full bg-muted-foreground/20">
        {pct !== null && (
          <span
            className={cn("absolute inset-y-0 left-0 rounded-full", pct >= danger ? "bg-destructive" : pct >= warn ? "bg-warning" : "bg-primary/70")}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        )}
      </span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

export function FooterResources() {
  const runners = useRunners();
  const live = useLiveRunnerMetrics(true);
  const [config, setConfig] = useState<FooterResourceConfig>(() => loadConfig());
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  // Close the popover on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const rows = useMemo(() => {
    const byId = new Map((runners.runners.data ?? []).map((r) => [r.id, r]));
    return [...live.values()]
      .filter((l) => byId.has(l.runnerId))
      .sort((a, b) => (byId.get(a.runnerId)!.name > byId.get(b.runnerId)!.name ? 1 : -1));
  }, [live, runners.runners.data]);

  const kindsOf = (runnerId: string) => config[runnerId] ?? ALL_KINDS;

  const toggleKind = (runnerId: string, kind: FooterMetricKind) => {
    setConfig((prev) => {
      const cur = prev[runnerId] ?? ALL_KINDS;
      const next = cur.includes(kind) ? cur.filter((k) => k !== kind) : [...cur, kind];
      return { ...prev, [runnerId]: next };
    });
  };

  return (
    <div className="text-muted-foreground relative flex flex-wrap items-center gap-x-4 gap-y-1 px-1 font-mono text-[11px]">
      {rows.length === 0 && <span className="text-muted-foreground/60">no live runners</span>}
      {rows.map((r) => {
        const kinds = kindsOf(r.runnerId);
        if (kinds.length === 0) return null;
        const name = runners.runners.data?.find((x) => x.id === r.runnerId)?.name ?? r.runnerId.slice(0, 8);
        const m = r.metrics;
        return (
          <span key={r.runnerId} className="flex items-center gap-3">
            <span className="font-semibold">{name}</span>
            {kinds.includes("cpu") && <MetricChip label="cpu" pct={m.cpu.busy * 100} value={`${Math.round(m.cpu.busy * 100)}%`} />}
            {kinds.includes("memory") && (
              <MetricChip label="mem" pct={(m.memory.used / Math.max(1, m.memory.total)) * 100} value={`${fmtBytes(m.memory.used)}/${fmtBytes(m.memory.total)}`} />
            )}
            {kinds.includes("gpu") &&
              m.gpus.map((g) => (
                <MetricChip
                  key={g.index}
                  label={`gpu${g.index}`}
                  pct={g.utilization}
                  value={`${Math.round(g.utilization)}%${g.temperature !== null ? ` ${g.temperature}°` : ""}`}
                />
              ))}
            {kinds.includes("disk") &&
              m.disks
                .filter((d) => !d.error)
                .map((d) => (
                  <MetricChip
                    key={d.path}
                    label={d.path === "/" ? "/" : d.path}
                    pct={(d.used / Math.max(1, d.total)) * 100}
                    value={`${fmtBytes(d.used)}/${fmtBytes(d.total)}`}
                  />
                ))}
          </span>
        );
      })}

      <button
        type="button"
        className={cn("hover:text-foreground ml-auto transition-colors", open && "text-foreground")}
        title="Choose resources to show"
        onClick={() => setOpen((v) => !v)}
      >
        <MonitorCog size={13} aria-hidden="true" />
      </button>

      {open && (
        <div ref={popRef} className="bg-card absolute bottom-6 right-0 z-50 w-72 rounded-lg border p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold">Footer resources</span>
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>
              <X size={13} aria-hidden="true" />
            </button>
          </div>
          {rows.length === 0 && <p className="text-muted-foreground text-xs">No live runners — start one to see metrics.</p>}
          {rows.map((r) => {
            const name = runners.runners.data?.find((x) => x.id === r.runnerId)?.name ?? r.runnerId.slice(0, 8);
            const kinds = kindsOf(r.runnerId);
            const m = r.metrics;
            return (
              <div key={r.runnerId} className="border-t py-2 first:border-t-0">
                <div className="mb-1 text-[11px] font-semibold">{name}</div>
                <div className="flex flex-wrap gap-1">
                  <ChipToggle on={kinds.includes("cpu")} onClick={() => toggleKind(r.runnerId, "cpu")} icon={<Cpu size={11} />} label="cpu" />
                  <ChipToggle on={kinds.includes("memory")} onClick={() => toggleKind(r.runnerId, "memory")} icon={<Cpu size={11} />} label="mem" />
                  {m.gpus.length > 0 && (
                    <ChipToggle on={kinds.includes("gpu")} onClick={() => toggleKind(r.runnerId, "gpu")} icon={<MonitorCog size={11} />} label={`gpu×${m.gpus.length}`} />
                  )}
                  {m.disks.length > 0 && (
                    <ChipToggle on={kinds.includes("disk")} onClick={() => toggleKind(r.runnerId, "disk")} icon={<HardDrive size={11} />} label={`disk×${m.disks.length}`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChipToggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors",
        on ? "border-primary/40 bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
