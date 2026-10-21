import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Cpu, HardDrive, MemoryStick, Plus, X } from "lucide-react";
import { useRunnerMetricsHistory } from "@/routes/code/use-runner-metrics";
import type { MetricsSample } from "@/routes/code/use-runner-metrics";
import { api } from "@/lib/api";
import type { Runner } from "./use-runners";

/**
 * Per-runner metrics panel: 30-day charts (10-min samples) for CPU, memory,
 * GPU and each configured disk, plus the disk-path editor that feeds the
 * metrics stream.
 */

const H = 60; // chart height
const W = 520;

/** Downsample a numeric series to ~W/2 points, preserving shape. */
function series(values: number[]): number[] {
  if (values.length <= 260) return values;
  const stride = Math.ceil(values.length / 260);
  const out: number[] = [];
  for (let i = 0; i < values.length; i += stride) {
    // max within the stride keeps spikes visible
    out.push(Math.max(...values.slice(i, i + stride)));
  }
  return out;
}

function AreaChart({ values, max, label, fmt }: { values: number[]; max: number; label: string; fmt: (v: number) => string }) {
  const pts = series(values);
  if (pts.length === 0) return <div className="text-muted-foreground/60 text-xs">no data yet</div>;
  const step = pts.length > 1 ? W / (pts.length - 1) : W;
  const y = (v: number) => H - Math.min(1, v / max) * H;
  const path = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${path} L${W},${H} L0,${H} Z`;
  const last = pts[pts.length - 1];
  const peak = Math.max(...pts);
  return (
    <div className="min-w-0 flex-1">
      <div className="text-muted-foreground mb-1 flex items-baseline justify-between text-[11px]">
        <span>{label}</span>
        <span className="tabular-nums">
          now {fmt(last)} · peak {fmt(peak)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" preserveAspectRatio="none">
        <path d={area} className="fill-primary/15" />
        <path d={path} className="stroke-primary/70" fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function fmtBytes(n: number) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}G`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return `${(n / 1e3).toFixed(0)}k`;
}

export function RunnerMetrics({ runner }: { runner: Runner }) {
  const history = useRunnerMetricsHistory(runner.id, 720);
  const queryClient = useQueryClient();
  const [newPath, setNewPath] = useState("");
  const [pathError, setPathError] = useState<string | null>(null);

  const saveDisks = useMutation({
    mutationFn: (paths: string[]) => api(`/api/runners/${runner.id}/disks`, { method: "PATCH", body: JSON.stringify({ paths }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["runners"] });
      setNewPath("");
      setPathError(null);
    },
    onError: (e) => setPathError(e.message),
  });

  const rows = (history.data ?? []) as MetricsSample[];

  const cols = useMemo(() => {
    // GPU columns: one per gpu index seen in the latest sample.
    const latest = rows[rows.length - 1];
    return latest?.gpus ?? [];
  }, [rows]);

  const diskPaths = useMemo(() => {
    const latest = rows[rows.length - 1];
    return latest?.disks.map((d) => d.path) ?? [];
  }, [rows]);

  const empty = rows.length === 0;

  return (
    <div className="space-y-4">
      {history.isPending && <p className="text-muted-foreground text-xs">loading metrics…</p>}
      {!history.isPending && empty && (
        <p className="text-muted-foreground text-xs">
          No samples yet — the runner reports every 10s and the first window persists within 10 minutes.
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <Cpu size={12} aria-hidden="true" /> CPU
              </div>
              <AreaChart values={rows.map((r) => r.cpu.busy * 100)} max={100} label="utilization %" fmt={(v) => `${v.toFixed(0)}%`} />
              <AreaChart values={rows.map((r) => r.cpu.load1)} max={Math.max(4, rows[rows.length - 1]?.cpu.cores ?? 4)} label="loadavg (1m)" fmt={(v) => v.toFixed(1)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <MemoryStick size={12} aria-hidden="true" /> Memory
              </div>
              <AreaChart
                values={rows.map((r) => r.memory.used)}
                max={rows[rows.length - 1]?.memory.total ?? 1}
                label="used"
                fmt={(v) => fmtBytes(v)}
              />
            </div>

            {cols.map((g) => (
              <div key={`gpu${g.index}`} className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  GPU {g.index} — <span className="text-muted-foreground truncate font-normal">{g.name}</span>
                </div>
                <AreaChart
                  values={rows.map((r) => r.gpus.find((x) => x.index === g.index)?.utilization ?? 0)}
                  max={100}
                  label="utilization %"
                  fmt={(v) => `${v.toFixed(0)}%`}
                />
                <AreaChart
                  values={rows.map((r) => r.gpus.find((x) => x.index === g.index)?.memoryUsed ?? 0)}
                  max={g.memoryTotal || 1}
                  label="vram"
                  fmt={(v) => fmtBytes(v)}
                />
              </div>
            ))}

            {rows[rows.length - 1]?.disks
              .filter((d) => !d.error)
              .map((d) => (
                <div key={d.path} className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <HardDrive size={12} aria-hidden="true" /> Disk <span className="text-muted-foreground font-mono font-normal">{d.path}</span>
                  </div>
                  <AreaChart values={rows.map((r) => r.disks.find((x) => x.path === d.path)?.used ?? 0)} max={d.total || 1} label="used" fmt={(v) => fmtBytes(v)} />
                </div>
              ))}
          </div>
        </>
      )}

      {/* Disk path config */}
      <div className="border-t pt-3">
        <div className="mb-1.5 text-xs font-semibold">Watched disk paths</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {diskPaths.map((p) => (
            <span key={p} className="flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px]">
              {p}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                title={`Stop watching ${p}`}
                onClick={() => saveDisks.mutate(diskPaths.filter((x) => x !== p))}
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const p = newPath.trim();
              if (!p.startsWith("/")) return setPathError("absolute paths only");
              if (diskPaths.includes(p)) return;
              saveDisks.mutate([...diskPaths, p]);
            }}
          >
            <input
              className="bg-accent h-6 w-40 rounded-sm px-2 font-mono text-[11px] outline-none"
              placeholder="/mnt/data"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
            />
            <button type="submit" className="hover:text-foreground text-muted-foreground" title="Add path">
              <Plus size={13} aria-hidden="true" />
            </button>
          </form>
        </div>
        {pathError && <p className="mt-1 text-[11px] text-destructive">{pathError}</p>}
        {saveDisks.isPending && <p className="text-muted-foreground mt-1 text-[11px]">saving…</p>}
        <p className="text-muted-foreground/60 mt-1.5 text-[11px]">Applies to the next sample (within 10s of the runner being online).</p>
      </div>
    </div>
  );
}
