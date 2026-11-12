import { qrPath } from "../../lib/qr";
import { deepLink } from "../../lib/router";
import { perPage, type LabelLayout, type LabelSpec, type PrintOptions } from "../layouts";

/**
 * Physical-size label pages in mm. Rendered twice: scaled down as the
 * on-screen preview, and at 1:1 into #tt-print-root for the printer.
 */
export function LabelSheet({ labels, layout, opts, maxPages }: { labels: LabelSpec[]; layout: LabelLayout; opts: PrintOptions; maxPages?: number }) {
  const slots: (LabelSpec | null)[] = [];
  const offset = layout.cols * layout.rows > 1 ? Math.min(opts.offset, perPage(layout) - 1) : 0;
  for (let i = 0; i < offset; i++) slots.push(null);
  for (const l of labels) for (let c = 0; c < Math.max(1, opts.copies); c++) slots.push(l);
  const pages: (LabelSpec | null)[][] = [];
  for (let i = 0; i < slots.length; i += perPage(layout)) pages.push(slots.slice(i, i + perPage(layout)));
  const shown = maxPages ? pages.slice(0, maxPages) : pages;

  return (
    <>
      {shown.map((page, pi) => (
        <div
          key={pi}
          className="tt-page relative overflow-hidden bg-white text-black"
          style={{ width: `${layout.pageW}mm`, height: `${layout.pageH}mm`, fontFamily: '"JetBrains Mono Variable", ui-monospace, Menlo, monospace' }}
        >
          {page.map((l, i) => {
            if (!l) return null;
            const col = i % layout.cols;
            const row = Math.floor(i / layout.cols);
            return (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${layout.marginLeft + col * (layout.labelW + layout.gapX)}mm`,
                  top: `${layout.marginTop + row * (layout.labelH + layout.gapY)}mm`,
                  width: `${layout.labelW}mm`,
                  height: `${layout.labelH}mm`,
                }}
              >
                <Label spec={l} w={layout.labelW} h={layout.labelH} opts={opts} />
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function Label({ spec, w, h, opts }: { spec: LabelSpec; w: number; h: number; opts: PrintOptions }) {
  const payload = opts.qr === "link" ? deepLink(spec.code) : spec.code;
  const { size, d } = qrPath(payload, opts.qr === "link" ? "L" : "M");
  const pad = Math.max(1.2, Math.min(w, h) * 0.07);
  const square = w / h < 1.5;
  const qrMm = square ? Math.min(h - pad * 2 - (opts.showText ? h * 0.2 : 0), w - pad * 2) : Math.min(h - pad * 2, w * 0.5);
  const codeMm = Math.max(2.2, Math.min(square ? h * 0.13 : h * 0.24, (w - qrMm - pad * 3) / 4.6));
  const qr = (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: `${qrMm}mm`, height: `${qrMm}mm`, flexShrink: 0 }} shapeRendering="crispEdges">
      <path d={d} fill="#000" />
    </svg>
  );

  if (square || !opts.showText) {
    return (
      <div className="flex size-full flex-col items-center justify-center" style={{ padding: `${pad}mm`, gap: `${pad * 0.4}mm` }}>
        {qr}
        {opts.showText && <div style={{ fontSize: `${codeMm}mm`, fontWeight: 800, lineHeight: 1, letterSpacing: "0.04em" }}>{spec.display}</div>}
      </div>
    );
  }
  return (
    <div className="flex size-full items-center" style={{ padding: `${pad}mm`, gap: `${pad}mm` }}>
      {qr}
      <div className="flex min-w-0 flex-1 flex-col justify-center" style={{ gap: `${codeMm * 0.25}mm` }}>
        <div style={{ fontSize: `${codeMm}mm`, fontWeight: 800, lineHeight: 1, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{spec.display}</div>
        {spec.title && (
          <div
            style={{
              fontFamily: '"Outfit Variable", system-ui, sans-serif',
              fontSize: `${Math.max(1.8, codeMm * 0.55)}mm`,
              fontWeight: 600,
              lineHeight: 1.15,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: h > 30 ? 3 : 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {spec.title}
          </div>
        )}
        {spec.subtitle && h > 22 && (
          <div style={{ fontFamily: '"Outfit Variable", system-ui, sans-serif', fontSize: `${Math.max(1.6, codeMm * 0.42)}mm`, lineHeight: 1.1, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {spec.subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
