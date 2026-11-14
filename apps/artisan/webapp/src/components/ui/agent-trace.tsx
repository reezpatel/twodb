import * as React from "react";
import { Bot, CircleAlert, Cpu, FileText, Pause, Play, Wrench, Zap } from "lucide-react";
import { cn } from "../../lib/cn.js";

/** What produced the span. Drives the icon and whether the bar uses the accent color. */
export type SpanKind = "agent" | "model" | "tool" | "io";
export type SpanStatus = "ok" | "error" | "cached";

export interface TraceSpan {
  id: string;
  label: string;
  /** Start offset in ms from the beginning of the run. */
  start: number;
  /** End offset in ms. */
  end: number;
  kind?: SpanKind;
  status?: SpanStatus;
  parentId?: string;
  /** One-line result shown on the right once the span finishes. */
  detail?: string;
  /** Tokens billed to this span; counts up as it replays. */
  tokens?: number;
  attempt?: number;
}

export interface AgentTraceProps {
  spans: TraceSpan[];
  duration?: number;
  runId?: string;
  model?: string;
  /** Replay from 0 on mount. Off by default: a finished run is the best resting state. */
  autoPlay?: boolean;
  showTransport?: boolean;
  selectedId?: string | null;
  onSpanSelect?: (span: TraceSpan) => void;
  className?: string;
}

interface LaidSpan extends TraceSpan {
  depth: number;
  dur: number;
}

interface RowHandle {
  el: HTMLElement;
  meta: HTMLElement | null;
  dur: HTMLElement | null;
  span: LaidSpan;
  lastP: number;
  lastState: string;
  lastMeta: string;
  lastDur: string;
}

const KIND_ICON = { agent: Bot, model: Cpu, tool: Wrench, io: FileText } as const;
const NICE_TICKS = [10, 20, 50, 100, 250, 500, 1000, 2000, 2500, 5000, 10_000, 30_000, 60_000, 120_000];
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const groupDigits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const formatMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`);

const metaText = (span: LaidSpan, progress: number) =>
  span.tokens != null ? `${groupDigits(Math.round(span.tokens * progress))} tk` : progress >= 1 ? (span.detail ?? "") : "";

function layout(spans: TraceSpan[]): LaidSpan[] {
  const children = new Map<string, TraceSpan[]>();
  const ids = new Set(spans.map((s) => s.id));
  for (const s of spans) {
    const key = s.parentId && s.parentId !== s.id && ids.has(s.parentId) ? s.parentId : "";
    const list = children.get(key);
    if (list) list.push(s);
    else children.set(key, [s]);
  }
  const out: LaidSpan[] = [];
  const seen = new Set<string>();
  const walk = (parent: string, depth: number) => {
    for (const kid of (children.get(parent) ?? []).slice().sort((a, b) => a.start - b.start)) {
      if (seen.has(kid.id)) continue;
      seen.add(kid.id);
      out.push({ ...kid, depth, dur: Math.max(0, kid.end - kid.start) });
      walk(kid.id, depth + 1);
    }
  };
  walk("", 0);
  for (const s of spans) if (!seen.has(s.id)) out.push({ ...s, depth: 0, dur: Math.max(0, s.end - s.start) });
  return out;
}

const SpanRow = React.memo(function SpanRow(props: {
  span: LaidSpan;
  index: number;
  total: number;
  selected: boolean;
  onSelect: (span: LaidSpan) => void;
  register: (index: number, handle: RowHandle | null) => void;
}) {
  const { span, index, total, selected, onSelect, register } = props;
  const Icon = KIND_ICON[span.kind ?? "tool"];
  const accent = span.kind === "agent" || span.kind === "model";
  const settled = span.status === "error" ? "error" : "done";
  const left = `${(span.start / total) * 100}%`;
  const width = `${(span.dur / total) * 100}%`;

  return (
    <div
      ref={(node) =>
        register(
          index,
          node
            ? {
                el: node,
                meta: node.querySelector<HTMLElement>("[data-part='meta']"),
                dur: node.querySelector<HTMLElement>("[data-part='dur']"),
                span,
                lastP: 1,
                lastState: settled,
                lastMeta: metaText(span, 1),
                lastDur: formatMs(span.dur),
              }
            : null,
        )
      }
      data-state={settled}
      data-selected={selected ? "true" : undefined}
      style={{ "--p": 1 } as React.CSSProperties}
      onClick={() => onSelect(span)}
      className={cn(
        "group/row relative flex h-9 cursor-pointer items-center rounded-md px-2 transition-colors",
        "hover:bg-surface-muted/60 data-[selected=true]:bg-surface-muted data-[state=running]:bg-surface-muted/60",
      )}
    >
      <div className="flex w-[var(--gutter)] shrink-0 items-center gap-1.5 pr-2" style={{ paddingLeft: span.depth * 12 }}>
        <Icon
          className={cn(
            "size-3.5 shrink-0 text-ink-muted transition-colors group-data-[state=queued]/row:text-ink-muted/60",
            accent && "group-data-[state=done]/row:text-ion-deep group-data-[state=running]/row:text-ion-deep",
          )}
        />
        <span className="truncate font-mono text-xs text-ink group-data-[state=queued]/row:text-ink-muted">{span.label}</span>
        {span.attempt != null && span.attempt > 1 ? (
          <span className="shrink-0 rounded bg-surface-muted px-1 font-mono text-[10px] leading-4 tabular-nums text-ink-muted">×{span.attempt}</span>
        ) : null}
      </div>

      <div className="relative h-full flex-1">
        <div className="absolute top-1/2 h-2 min-w-[3px] -translate-y-1/2 overflow-hidden rounded-full" style={{ left, width }}>
          <span className="absolute inset-0 bg-ink/10" />
          <span
            className={cn(
              "absolute inset-0 origin-left",
              span.status === "error" ? "bg-destructive" : accent ? "bg-ion-deep" : span.status === "cached" ? "bg-ink/25" : "bg-ink/50",
            )}
            style={{ transform: "scaleX(var(--p,1))" }}
          />
        </div>
      </div>

      <div className="flex w-[var(--meta)] shrink-0 items-center justify-end gap-1.5 pl-2 transition-opacity group-data-[state=queued]/row:opacity-0">
        {span.status === "error" ? <CircleAlert className="size-3.5 shrink-0 text-destructive" /> : null}
        {span.status === "cached" ? <Zap className="size-3 shrink-0 text-ink-muted" /> : null}
        <span data-part="meta" className="hidden truncate font-mono text-[11px] tabular-nums text-ink-muted @md/trace:inline">
          {metaText(span, 1)}
        </span>
        <span data-part="dur" className={cn("shrink-0 font-mono text-[11px] tabular-nums", span.status === "error" ? "text-destructive" : "text-ink/70")}>
          {formatMs(span.dur)}
        </span>
      </div>
    </div>
  );
});

/**
 * An agent run on a scrubbable time axis. Every visual derives from one playhead
 * time; the replay loop writes one CSS variable per row per frame, no React state.
 */
export function AgentTrace({ spans, duration, runId = "run", model, autoPlay = false, showTransport = true, selectedId, onSpanSelect, className }: AgentTraceProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const railRef = React.useRef<HTMLDivElement>(null);
  const clockRef = React.useRef<HTMLSpanElement>(null);
  const rowsRef = React.useRef<(RowHandle | null)[]>([]);
  const timeRef = React.useRef(0);
  const playingRef = React.useRef(false);
  const seekRef = React.useRef<(ms: number) => void>(() => {});
  const runRef = React.useRef<() => void>(() => {});
  const haltRef = React.useRef<() => void>(() => {});
  const [playing, setPlaying] = React.useState(false);

  const rows = React.useMemo(() => layout(spans), [spans]);
  const total = React.useMemo(() => Math.max(1, duration ?? rows.reduce((m, s) => Math.max(m, s.end), 0)), [rows, duration]);
  const ticks = React.useMemo(() => {
    const step = NICE_TICKS.find((t) => total / t <= 6) ?? total / 4;
    const out: number[] = [];
    for (let t = step; t < total; t += step) out.push(t);
    return out;
  }, [total]);

  const totalRef = React.useRef(total);
  React.useLayoutEffect(() => {
    totalRef.current = total;
  });

  const registerRow = React.useCallback((index: number, handle: RowHandle | null) => {
    rowsRef.current[index] = handle;
  }, []);

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last = 0;

    const paint = () => {
      const t = timeRef.current;
      const tot = totalRef.current;
      root.style.setProperty("--t", (t / tot).toFixed(5));
      for (const row of rowsRef.current) {
        if (!row) continue;
        const { span } = row;
        const p = span.dur > 0 ? clamp((t - span.start) / span.dur, 0, 1) : t >= span.start ? 1 : 0;
        if (p !== row.lastP) {
          row.el.style.setProperty("--p", p.toFixed(4));
          row.lastP = p;
        }
        const state = t < span.start ? "queued" : p < 1 ? "running" : span.status === "error" ? "error" : "done";
        if (state !== row.lastState) {
          row.el.dataset.state = state;
          row.lastState = state;
        }
        const dur = state === "queued" ? "" : formatMs(span.dur * p);
        if (row.dur && dur !== row.lastDur) {
          row.dur.textContent = dur;
          row.lastDur = dur;
        }
        const meta = state === "queued" ? "" : metaText(span, p);
        if (row.meta && meta !== row.lastMeta) {
          row.meta.textContent = meta;
          row.lastMeta = meta;
        }
      }
      if (clockRef.current) clockRef.current.textContent = `${(t / 1000).toFixed(2)}s / ${(tot / 1000).toFixed(2)}s`;
      railRef.current?.setAttribute("aria-valuenow", String(Math.round(t)));
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(now - (last || now), 100);
      last = now;
      timeRef.current += dt;
      if (timeRef.current >= totalRef.current) {
        timeRef.current = totalRef.current;
        playingRef.current = false;
        setPlaying(false);
      }
      paint();
      if (playingRef.current) raf = requestAnimationFrame(frame);
    };
    runRef.current = () => {
      if (raf || !playingRef.current) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    haltRef.current = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    seekRef.current = (ms) => {
      timeRef.current = clamp(ms, 0, totalRef.current);
      last = 0;
      paint();
    };

    timeRef.current = totalRef.current;
    if (autoPlay && !media.matches) {
      timeRef.current = 0;
      playingRef.current = true;
      setPlaying(true);
    }
    paint();
    runRef.current();
    return () => {
      haltRef.current();
      runRef.current = haltRef.current = seekRef.current = () => {};
    };
  }, [autoPlay]);

  // New spans (different round) → show the finished run.
  React.useLayoutEffect(() => {
    rowsRef.current.length = rows.length;
    seekRef.current(playingRef.current ? timeRef.current : total);
  }, [rows, total]);

  const togglePlay = () => {
    const next = !playingRef.current;
    if (next && timeRef.current >= total) timeRef.current = 0;
    playingRef.current = next;
    setPlaying(next);
    seekRef.current(timeRef.current);
    if (next) runRef.current();
    else haltRef.current();
  };

  const scrubFrom = (clientX: number, el: HTMLElement) => {
    const inset = Number(el.dataset.inset ?? 0);
    const rect = el.getBoundingClientRect();
    const width = rect.width - inset * 2;
    if (width > 0) seekRef.current(((clientX - rect.left - inset) / width) * total);
  };
  const scrub = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      scrubFrom(e.clientX, e.currentTarget);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubFrom(e.clientX, e.currentTarget);
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    },
  };
  const onRailKeyDown = (e: React.KeyboardEvent) => {
    const step = total / 50;
    if (e.key === "Home") seekRef.current(0);
    else if (e.key === "End") seekRef.current(total);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") seekRef.current(timeRef.current + step);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") seekRef.current(timeRef.current - step);
    else return;
    e.preventDefault();
  };

  const onSelectRef = React.useRef(onSpanSelect);
  onSelectRef.current = onSpanSelect;
  const selectSpan = React.useCallback((span: LaidSpan) => onSelectRef.current?.(span), []);

  // One box for ruler, gridlines, playhead and scrub surface so they line up with the bars.
  const trackBox = "absolute left-[calc(var(--gutter)+0.5rem)] right-[calc(var(--meta)+0.5rem)]";

  return (
    <div
      ref={rootRef}
      className={cn(
        "@container/trace w-full",
        "[--gutter:110px] [--meta:3.75rem] @sm/trace:[--gutter:150px] @md/trace:[--gutter:200px] @md/trace:[--meta:8rem]",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-2 pb-2">
        <span className="font-mono text-[13px] font-medium text-ink">{runId}</span>
        <span className="truncate text-xs text-ink-muted">
          {model ? `${model} · ` : ""}
          {rows.length} spans
        </span>
      </div>

      <div className="relative">
        <div className="relative h-6 cursor-ew-resize touch-none select-none" {...scrub}>
          <div className={cn(trackBox, "inset-y-0")}>
            {ticks.map((t) => (
              <span key={t} className="absolute top-1.5 -translate-x-1/2 font-mono text-[10px] leading-none tabular-nums text-ink-muted" style={{ left: `${(t / total) * 100}%` }}>
                {t < 1000 ? `${t}ms` : `${t / 1000}s`}
              </span>
            ))}
          </div>
        </div>

        <div className="relative pb-1">
          <div aria-hidden className={cn(trackBox, "inset-y-0")}>
            {ticks.map((t) => (
              <span key={t} className="absolute inset-y-0 w-px bg-outline/50" style={{ left: `${(t / total) * 100}%` }} />
            ))}
          </div>

          <div className="relative">
            {rows.map((span, i) => (
              <SpanRow key={span.id} span={span} index={i} total={total} selected={selectedId === span.id} onSelect={selectSpan} register={registerRow} />
            ))}
          </div>

          <div aria-hidden className={cn(trackBox, "pointer-events-none inset-y-0")}>
            <div className="relative h-full w-full" style={{ transform: "translateX(calc(var(--t,0) * 100%))" }}>
              <span className="absolute inset-y-0 w-px bg-ion-deep/70" />
              <span className="absolute top-0 size-1.5 -translate-x-[2.5px] rotate-45 bg-ion-deep" />
            </div>
          </div>

        </div>
      </div>

      {showTransport ? (
        <div className="flex items-center gap-3 px-2 pt-1">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause replay" : "Replay"}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink transition-colors hover:bg-outline-strong"
          >
            {playing ? <Pause className="size-3 fill-current" /> : <Play className="size-3 translate-x-px fill-current" />}
          </button>
          <div
            ref={railRef}
            role="slider"
            tabIndex={0}
            aria-label="Playhead"
            aria-valuemin={0}
            aria-valuemax={Math.round(total)}
            aria-valuenow={Math.round(total)}
            data-inset="6"
            onKeyDown={onRailKeyDown}
            {...scrub}
            className="relative h-7 flex-1 cursor-ew-resize touch-none select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="absolute inset-x-1.5 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full w-full origin-left bg-ion-deep" style={{ transform: "scaleX(var(--t,0))" }} />
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-1.5 right-1.5">
              <div className="relative h-full w-full" style={{ transform: "translateX(calc(var(--t,0) * 100%))" }}>
                <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ion-deep" />
              </div>
            </div>
          </div>
          <span ref={clockRef} className="w-[7rem] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-muted" />
        </div>
      ) : null}
    </div>
  );
}
