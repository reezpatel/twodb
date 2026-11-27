import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@twodb/blocks";
import { ChevronDown, Printer } from "lucide-react";
import { usePrintStudio } from "./hooks/usePrintStudio";
import { LAYOUTS, perPage, type LabelSpec } from "./layouts";
import { LabelSheet } from "./partials/LabelSheet";

const control = "h-8 rounded-[6px] border border-ink/20 bg-transparent px-2.5 text-[13px] outline-none transition focus:border-ink/50";
const seg = "h-full rounded-[4px] text-[12px] font-medium transition";

function Opt({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[12px] font-medium text-ink">{label}</div>
      {children}
      {hint && <div className="text-[12px] font-light text-ink-muted">{hint}</div>}
    </div>
  );
}

const MM = 3.7795; // CSS px per mm

/** Layout/options panel + true-to-scale preview + print. */
export function PrintStudio({ labels, children, extraOptions }: { labels: LabelSpec[]; children?: ReactNode; extraOptions?: ReactNode }) {
  const h = usePrintStudio(labels);
  const L = h.layout;
  const previewW = h.sheet ? 420 : Math.min(260, L.pageW * MM * 3);
  const scale = previewW / (L.pageW * MM);

  const stockLabel = LAYOUTS.find((l) => l.id === h.opts.layoutId)?.name ?? "Select stock";

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-6 rounded-[6px] border border-outline bg-card p-4 md:p-5 lg:sticky lg:top-4 lg:self-start">
        {children}
        <Opt label="Label stock">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(control, "flex w-full items-center justify-between gap-2 text-left")}>
                <span className="truncate">{stockLabel}</span>
                <ChevronDown className="size-3.5 shrink-0 text-ink-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              <DropdownMenuRadioGroup value={h.opts.layoutId} onValueChange={(v) => h.set("layoutId", v)}>
                {(["Sheets", "Rolls"] as const).map((g, i) => (
                  <div key={g}>
                    {i > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel>{g}</DropdownMenuLabel>
                    {LAYOUTS.filter((l) => l.group === g).map((l) => (
                      <DropdownMenuRadioItem key={l.id} value={l.id}>
                        {l.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </div>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </Opt>

        <Opt
          label="QR contains"
          hint={
            h.opts.qr === "link"
              ? "Opens TwoThing from a phone camera. Denser: use labels of 25 mm or more."
              : "Smallest, most robust. Scan with TwoThing's scanner."
          }
        >
          <div className="grid h-8 grid-cols-2 gap-1 rounded-[6px] border border-ink/20 p-[3px]">
            {(["code", "link"] as const).map((q) => (
              <button key={q} onClick={() => h.set("qr", q)} className={cn(seg, h.opts.qr === q ? "bg-ink text-paper" : "text-ink-muted hover:text-ink")}>
                {q === "code" ? "Code only" : "Deep link"}
              </button>
            ))}
          </div>
        </Opt>

        <div className="grid grid-cols-2 gap-3">
          {h.sheet && (
            <Opt label="Skip first" hint="Used positions">
              <input
                type="number"
                min={0}
                max={perPage(L) - 1}
                value={h.opts.offset}
                onChange={(e) => h.set("offset", Math.max(0, Math.min(perPage(L) - 1, Number(e.target.value) || 0)))}
                className={cn(control, "w-full")}
              />
            </Opt>
          )}
          <Opt label="Copies each">
            <input
              type="number"
              min={1}
              max={10}
              value={h.opts.copies}
              onChange={(e) => h.set("copies", Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              className={cn(control, "w-full")}
            />
          </Opt>
        </div>

        <div className="space-y-3">
          {extraOptions}
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={h.opts.showText} onChange={(e) => h.set("showText", e.target.checked)} className="accent-[var(--ink)]" />
            Print code text {labels.some((l) => l.title) && "& names"}
          </label>
        </div>

        <button
          onClick={h.print}
          disabled={!labels.length}
          className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[6px] bg-ink px-3 text-[12px] font-medium text-paper transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-40"
        >
          <Printer className="size-3.5" /> Print {h.total} label{h.total === 1 ? "" : "s"}
        </button>
        <p className="text-[12px] font-light text-ink-muted">
          {h.pages} page{h.pages === 1 ? "" : "s"}. In the print dialog choose <b className="font-medium">scale 100% / actual size</b> and no margins
          {h.sheet ? "" : "; set the printer's paper size to the label size"}.
        </p>
      </div>

      <section className="min-w-0 space-y-3">
        <h2 className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
          Preview {h.pages > (h.sheet ? 2 : 12) && `(first ${h.sheet ? 2 : 12} of ${h.pages} pages)`}
        </h2>
        <div className="min-w-0 rounded-[6px] border border-outline bg-stone/50 p-4 md:p-6">
          {labels.length === 0 ? (
            <div className="py-16 text-center text-sm text-ink-muted">Nothing to print.</div>
          ) : (
            <div className={cn("flex flex-wrap", h.sheet ? "justify-center gap-4" : "justify-start gap-2")}>
              <ScaledSheets labels={labels} scale={scale} h={h} maxPages={h.sheet ? 2 : 12} />
            </div>
          )}
        </div>
      </section>

      {h.root && createPortal(<LabelSheet labels={labels} layout={L} opts={h.opts} />, h.root)}
    </div>
  );
}

function ScaledSheets({ labels, scale, h, maxPages }: { labels: LabelSpec[]; scale: number; h: ReturnType<typeof usePrintStudio>; maxPages: number }) {
  const L = h.layout;
  return (
    <>
      {/* each page is wrapped so the scaled box occupies its scaled size in flow */}
      <div className="contents">
        {Array.from({ length: Math.min(maxPages, h.pages) }).map((_, pi) => (
          <div
            key={pi}
            className="overflow-hidden rounded-sm shadow-lg ring-1 ring-black/10"
            style={{ width: L.pageW * MM * scale, height: L.pageH * MM * scale }}
          >
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: `${L.pageW}mm` }}>
              <PageSlice labels={labels} pageIndex={pi} h={h} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Render just one page of the sheet (re-using LabelSheet's paging maths). */
function PageSlice({ labels, pageIndex, h }: { labels: LabelSpec[]; pageIndex: number; h: ReturnType<typeof usePrintStudio> }) {
  const per = perPage(h.layout);
  const copies = Math.max(1, h.opts.copies);
  const offset = h.sheet ? h.opts.offset : 0;
  // Expand copies, then take this page's window (accounting for the first-page offset).
  const flat = labels.flatMap((l) => Array.from({ length: copies }, () => l));
  const start = pageIndex === 0 ? 0 : pageIndex * per - offset;
  const count = pageIndex === 0 ? per - offset : per;
  const slice = flat.slice(start, start + count);
  return <LabelSheet labels={slice} layout={h.layout} opts={{ ...h.opts, copies: 1, offset: pageIndex === 0 ? offset : 0 }} maxPages={1} />;
}
