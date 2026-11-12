import { getShape } from "@shared/shapes";

/** Draws one catalogue shape at an exact size. Pure presentation. */
export function ShapeSvg(props: { pack: string; shape: string; width: number; height: number; fill?: string; stroke?: string; dashed?: boolean }) {
  const s = getShape(props.pack, props.shape);
  const w = Math.max(1, props.width);
  const h = Math.max(1, props.height);
  const stroke = props.stroke ?? s.stroke ?? "#334155";
  const sw = s.heavy ? 4 : 1.5;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 overflow-visible" aria-hidden>
      <path d={s.d(w, h)} fill={props.fill ?? s.fill ?? "#ffffff"} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeDasharray={props.dashed ? "6 4" : undefined} />
      {s.marks && <path d={s.marks(w, h)} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />}
    </svg>
  );
}
