import { MonitorCog } from "lucide-react";
import type { ReactNode } from "react";
import { useFooterRunnerResources } from "../../use-footer-runner-resources";
import { FooterWidget } from "./footer-widget";
import { cn } from "@/lib/utils";

/**
 * Bottom-bar runner resources widget, mirroring FooterUsage: pinned chips for
 * the selected metrics (per runner × kind), popover with checkboxes to pick
 * what shows. Selection persists in footer_preference (key runner_resources).
 */

function fmtBytes(n: number) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(0)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(0)}G`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return `${Math.round(n / 1e3)}k`;
}

function Chip({ label, pct, value }: { label: string; pct: number | null; value: string }) {
  return (
    <span className="flex items-center gap-1.5" title={`${label} ${value}${pct !== null ? ` (${Math.round(pct)}%)` : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="relative h-1 w-8 overflow-hidden rounded-full bg-muted-foreground/20">
        {pct !== null && (
          <span
            className={cn("absolute inset-y-0 left-0 rounded-full", pct >= 95 ? "bg-destructive" : pct >= 85 ? "bg-warning" : "bg-primary/70")}
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        )}
      </span>
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

const KIND_LABEL: Record<string, string> = { cpu: "CPU", memory: "Mem", gpu: "GPU", disk: "Disks" };

export function FooterRunnerResources() {
  const { runners, selected, toggle } = useFooterRunnerResources();

  const live = runners.filter((r) => r.live);
  const pinnedOf = (runnerId: string) => selected.filter((s) => s.startsWith(`${runnerId}:`)).map((s) => s.split(":")[1]);

  return (
    <FooterRunnerResourcesPopover runners={runners} selected={selected} toggle={toggle}>
      {live.map((r) => {
        const kinds = pinnedOf(r.id);
        const m = r.live!.metrics;
        return (
          <span key={r.id} className="flex min-w-0 items-center gap-2.5 text-xs">
            <span className="truncate font-medium">{r.name}</span>
            {kinds.includes("cpu") && <Chip label="cpu" pct={m.cpu.busy * 100} value={`${Math.round(m.cpu.busy * 100)}%`} />}
            {kinds.includes("memory") && (
              <Chip label="mem" pct={(m.memory.used / Math.max(1, m.memory.total)) * 100} value={`${fmtBytes(m.memory.used)}/${fmtBytes(m.memory.total)}`} />
            )}
            {kinds.includes("gpu") &&
              m.gpus.map((g) => (
                <Chip
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
                  <Chip
                    key={d.path}
                    label={d.path === "/" ? "/" : d.path}
                    pct={(d.used / Math.max(1, d.total)) * 100}
                    value={`${fmtBytes(d.used)}/${fmtBytes(d.total)}`}
                  />
                ))}
          </span>
        );
      })}
    </FooterRunnerResourcesPopover>
  );
}

import { useState } from "react";
import { Checkbox } from "../../ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import type { FooterRunnerRow } from "../../use-footer-runner-resources";

function FooterRunnerResourcesPopover({
  runners,
  selected,
  toggle,
  children,
}: {
  runners: FooterRunnerRow[];
  selected: string[];
  toggle: (id: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FooterWidget aria-label="Runner resources" icon={<MonitorCog size={13} />}>
          {children}
        </FooterWidget>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium">Runner resources</span>
          <span className="text-muted-foreground pr-1 text-[11px] tabular-nums">{selected.length} pinned</span>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {runners.length === 0 ? (
            <p className="text-muted-foreground px-3 py-4 text-xs">No runners yet.</p>
          ) : (
            runners.map((r) => (
              <div key={r.id} className="mb-1 last:mb-0">
                <div className="text-muted-foreground flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium">
                  <span className="truncate">{r.name}</span>
                  {!r.live && <span className="text-muted-foreground/60 font-normal">{r.online ? "no reports (old runner?)" : "offline"}</span>}
                </div>
                {(["cpu", "memory", "gpu", "disk"] as const)
                  .filter((kind) => kind !== "gpu" || (r.live?.metrics.gpus.length ?? 0) > 0)
                  .filter((kind) => kind !== "disk" || (r.live?.metrics.disks.filter((d) => !d.error).length ?? 0) > 0)
                  .map((kind) => {
                    const id = `${r.id}:${kind}`;
                    const checked = selected.includes(id);
                    return (
                      <label
                        key={id}
                        className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          toggle(id);
                        }}
                      >
                        <Checkbox checked={checked} tabIndex={-1} />
                        <span className="text-muted-foreground">{KIND_LABEL[kind]}</span>
                        {r.live && kind === "cpu" && (
                          <span className="text-muted-foreground ml-auto tabular-nums">{Math.round(r.live.metrics.cpu.busy * 100)}%</span>
                        )}
                        {r.live && kind === "memory" && (
                          <span className="text-muted-foreground ml-auto tabular-nums">
                            {fmtBytes(r.live.metrics.memory.used)}/{fmtBytes(r.live.metrics.memory.total)}
                          </span>
                        )}
                      </label>
                    );
                  })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
