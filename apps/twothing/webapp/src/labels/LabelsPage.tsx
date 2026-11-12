import { cn } from "@twodb/blocks";
import { ChevronRight, Dices, Info, Printer, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import { timeAgo } from "../lib/format";
import { Link } from "../lib/router";
import { EmptyState } from "../ui/EmptyState";
import { inputCls } from "../ui/Field";
import { Page, PageHeader, Section, Spinner, btn } from "../ui/Page";
import { QrSvg } from "../ui/QrSvg";
import { useLabelsPage } from "./hooks/useLabelsPage";

export function LabelsPage() {
  const h = useLabelsPage();
  return (
    <Page>
      <PageHeader title="Labels" subtitle="Print a stack of random QR labels now, stick them on things and boxes as you go, scan to assign." />

      {/* generator hero */}
      <div className="relative mb-6 overflow-hidden rounded-[22px] border border-outline bg-card">
        <div className="pointer-events-none absolute -top-6 -right-6 hidden rotate-6 gap-2 opacity-90 md:grid md:grid-cols-3">
          {["K7QM2X", "9TRB4H", "XW3N0D", "M5PZ7A", "2HCQ8V", "QJ6KT1"].map((c) => (
            <div key={c} className="rounded-xl border border-outline bg-white p-2 shadow-sm">
              <QrSvg text={c} className="size-16" quiet={0} />
              <div className="mt-1 text-center font-mono text-[10px] font-bold text-black">{c.slice(0, 3)}-{c.slice(3)}</div>
            </div>
          ))}
        </div>
        <div className="relative space-y-5 p-5 md:max-w-[60%] md:p-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">
            <Dices className="size-3.5" /> Random · unique · unused
          </div>
          <div>
            <div className="text-xl font-bold md:text-2xl">Generate a batch</div>
            <div className="mt-1 text-sm text-ink-muted">Non-sequential 6-character codes. Never one that's on an item or place, never one generated in the last {h.windowDays} days.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {h.presets.map((p) => (
              <button key={p} onClick={() => h.setCount(p)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold tabular-nums transition", h.count === p ? "border-ink bg-ink text-paper" : "border-outline bg-paper hover:border-ink/30")}>
                {p}
                {h.sheetSize && p % h.sheetSize === 0 ? <span className="ml-1 text-xs opacity-60">· {p / h.sheetSize} sheet{p / h.sheetSize > 1 ? "s" : ""}</span> : null}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" min={1} max={1000} value={h.count} onChange={(e) => h.setCount(Number(e.target.value))} className={cn(inputCls, "w-28 text-lg font-semibold tabular-nums")} />
            <input value={h.note} onChange={(e) => h.setNote(e.target.value)} placeholder="Note (optional) — e.g. “workshop drawers”" className={cn(inputCls, "min-w-48 flex-1")} />
          </div>
          <button onClick={() => void h.generate()} disabled={h.busy} className={cn(btn.primary, "px-6 py-3 text-base")}>
            <Sparkles className="size-5" /> {h.busy ? "Generating…" : `Generate ${h.count} & print`}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Section title="Print batches">
          {h.loading ? (
            <Spinner />
          ) : h.batches.length === 0 ? (
            <EmptyState icon={QrCode} title="No batches yet">
              Generate your first batch above. Each batch is kept so you can reprint the unused ones.
            </EmptyState>
          ) : (
            <div className="-mx-2 divide-y divide-outline">
              {h.batches.map((b) => {
                const pct = b.live ? (b.used / b.live) * 100 : 0;
                return (
                  <Link key={b.id} to={`/labels/batch/${b.id}`} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-stone/60">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-outline bg-paper">
                      <Printer className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{b.note || `${b.count} labels`}</div>
                      <div className="text-xs text-ink-muted">
                        {new Date(b.createdAt).toLocaleDateString()} · {timeAgo(b.createdAt)}
                        {b.live < b.count && ` · ${b.count - b.live} re-issued later`}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 max-w-48 flex-1 overflow-hidden rounded-full bg-stone">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-ink-muted tabular-nums">
                          {b.used}/{b.live} used
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-ink-muted" />
                  </Link>
                );
              })}
            </div>
          )}
        </Section>

        <div className="space-y-4">
          <Section title="Label pool">
            <div className="grid grid-cols-2 gap-3">
              <Stat n={h.pool.free} label="unused, printed" />
              <Stat n={h.pool.fresh} label={`from last ${h.windowDays} days`} />
            </div>
          </Section>
          <Section title={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> How uniqueness works</span>}>
            <ul className="space-y-2 text-sm text-ink-muted">
              <li>• Codes are random (32⁶ ≈ 1 billion), never sequential.</li>
              <li>• A code on any item or place is <b className="text-ink">never</b> issued again.</li>
              <li>• A code generated in the last {h.windowDays} days is never issued again — so a fresh stack never duplicates a recent one.</li>
              <li>• Unused codes older than that may come back; bin old unused sheets.</li>
              <li>• Look-alikes are fixed when typing: O→0, I/L→1.</li>
            </ul>
          </Section>
          <div className="flex items-start gap-2 rounded-2xl border border-outline bg-card p-3 text-xs text-ink-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Need labels with names on them? Select items in <Link to="/items" className="font-semibold text-ink underline">Items</Link> → <b>Labels</b>, or use <b>Print</b> on any item or place.
            </span>
          </div>
        </div>
      </div>
    </Page>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl border border-outline bg-paper p-3">
      <div className="text-2xl font-bold tabular-nums">{n}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}
