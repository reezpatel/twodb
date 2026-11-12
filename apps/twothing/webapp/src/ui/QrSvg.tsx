import { qrPath } from "../lib/qr";

/** Crisp vector QR (quiet zone included). */
export function QrSvg({ text, className, quiet = 1 }: { text: string; className?: string; quiet?: number }) {
  const { size, d } = qrPath(text);
  const s = size + quiet * 2;
  return (
    <svg viewBox={`${-quiet} ${-quiet} ${s} ${s}`} className={className} shapeRendering="crispEdges" role="img" aria-label={`QR code ${text}`}>
      <rect x={-quiet} y={-quiet} width={s} height={s} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
