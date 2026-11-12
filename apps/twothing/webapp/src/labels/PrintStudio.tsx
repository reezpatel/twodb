import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@twodb/blocks";
import { Printer } from "lucide-react";
import { Field, inputCls } from "../ui/Field";
import { btn } from "../ui/Page";
import { usePrintStudio } from "./hooks/usePrintStudio";
import { LAYOUTS, perPage, type LabelSpec } from "./layouts";
import { LabelSheet } from "./partials/LabelSheet";

const MM = 3.7795; // CSS px per mm

/** Layout/options panel + true-to-scale preview + print. */
export function PrintStudio({ labels, children }: { labels: LabelSpec[]; children?: ReactNode }) {
  const h = usePrintStudio(labels);
  const L = h.layout;
  const previewW = h.sheet ? 420 : Math.min(260, L.pageW * MM * 3);
  const scale = previewW / (L.pageW * MM);

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-4 rounded-[18px] border border-outline bg-card p-4 md:p-5 lg:sticky lg:top-4 lg:self-start">
        {children}
        <Field label="Label stock">
          <select value={h.opts.layoutId} onChange={(e) => h.set("layoutId", e.target.value)} className={inputCls}>
            {(["Sheets", "Rolls"] as const).map((g) => (
              <optgroup key={g} label={g}>
                {LAYOUTS.filter((l) => l.group === g).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="QR contains" hint={h.opts.qr === "link" ? "Phone camera apps open TwoThing straight on the item. Denser QR — use ≥ 25 mm labels." : "Smallest, most robust QR. Scan with TwoThing's scanner."}>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-outline bg-paper p-1">
            {(["code", "link"] as const).map((q) => (
              <button key={q} onClick={() => h.set("qr", q)} className={cn("rounded-lg py-1.5 text-sm font-semibold", h.opts.qr === q ? "bg-ink text-paper" : "text-ink-muted hover:text-ink")}>
                {q === "code" ? "Code only" : "Deep link"}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {h.sheet && (
            <Field label="Skip first" hint="Used positions">
              <input type="number" min={0} max={perPage(L) - 1} value={h.opts.offset} onChange={(e) => h.set("offset", Math.max(0, Math.min(perPage(L) - 1, Number(e.target.value) || 0)))} className={inputCls} />
            </Field>
          )}
          <Field label="Copies each">
            <input type="number" min={1} max={10} value={h.opts.copies} onChange={(e) => h.set("copies", Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className={inputCls} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={h.opts.showText} onChange={(e) => h.set("showText", e.target.checked)} className="accent-[var(--ink)]" />
          Print code text {labels.some((l) => l.title) && "& names"}
        </label>
        <button onClick={h.print} disabled={!labels.length} className={cn(btn.primary, "w-full py-3 text-base")}>
          <Printer className="size-5" /> Print {h.total} label{h.total === 1 ? "" : "s"}
        </button>
        <p className="text-xs text-ink-muted">
          {h.pages} page{h.pages === 1 ? "" : "s"}. In the print dialog choose <b>scale 100% / actual size</b> and no margins{h.sheet ? "" : "; set the printer's paper size to the label size"}.
        </p>
      </div>

      <div className="min-w-0 rounded-[18px] border border-outline bg-stone/50 p-4 md:p-6">
        <div className="mb-3 text-xs font-semibold tracking-wider text-ink-muted uppercase">Preview {h.pages > (h.sheet ? 2 : 12) && `(first ${h.sheet ? 2 : 12} of ${h.pages} pages)`}</div>
        <div className={cn("flex flex-wrap gap-4", h.sheet ? "justify-center" : "justify-start")}>
          {labels.length === 0 ? (
            <div className="py-16 text-center text-sm text-ink-muted">Nothing to print.</div>
          ) : (
            <div className={cn("flex flex-wrap gap-4", !h.sheet && "gap-2")}>
              <ScaledSheets labels={labels} scale={scale} h={h} maxPages={h.sheet ? 2 : 12} />
            </div>
          )}
        </div>
      </div>

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
          <div key={pi} className="overflow-hidden rounded-sm shadow-lg ring-1 ring-black/10" style={{ width: L.pageW * MM * scale, height: L.pageH * MM * scale }}>
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
