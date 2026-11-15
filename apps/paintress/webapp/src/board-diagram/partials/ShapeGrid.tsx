import { SHAPES, SHAPE_PACKS } from "@shared/shapes";
import { useCanvasTheme, visibleStroke } from "../../lib/canvas-theme";
import { sameSpec, type ArmedSpec } from "../hooks/usePlacement";
import { PaletteItem } from "./PaletteItem";

function Preview({ pack, id }: { pack: string; id: string }) {
  const theme = useCanvasTheme();
  const s = SHAPES.find((x) => x.pack === pack && x.id === id)!;
  const scale = Math.min(44 / s.w, 30 / s.h);
  const w = s.w * scale;
  const h = s.h * scale;
  return (
    <svg width={w + 4} height={h + 4} viewBox={`-2 -2 ${w + 4} ${h + 4}`}>
      <path d={s.d(w, h)} style={{ fill: s.fill ?? theme.shapeFill, stroke: visibleStroke(s.stroke ?? theme.shapeStroke, theme), strokeWidth: s.heavy ? 2.5 : 1.2 }} />
      {s.marks && <path d={s.marks(w, h)} fill="none" style={{ stroke: visibleStroke(s.stroke ?? theme.shapeStroke, theme), strokeWidth: 1 }} />}
    </svg>
  );
}

const PACK_LABEL: Record<string, string> = { basic: "Basic", flowchart: "Flowchart", bpmn: "BPMN", c4: "C4" };

export function ShapeGrid(props: {
  pack: string;
  onPack(p: string): void;
  armed: unknown;
  onArm(pack: string, shape: string): void;
  /** Restrict the pack tabs (default: all packs). */
  packs?: readonly string[];
  /** Hide these shapes ("pack:id"), e.g. the quick square/circle dock buttons. */
  exclude?: string[];
}) {
  const packs = props.packs ?? SHAPE_PACKS;
  const excluded = new Set(props.exclude ?? []);
  const shapes = SHAPES.filter((s) => s.pack === props.pack && !excluded.has(`${s.pack}:${s.id}`));
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex-wrap gap-1 ${packs.length > 1 ? "flex" : "hidden"}`}>
        {packs.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => props.onPack(p)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] ${props.pack === p ? "border-ink bg-ink text-paper" : "border-outline text-ink-muted hover:bg-paper-grid"}`}
          >
            {PACK_LABEL[p]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {shapes.map((s) => (
          <PaletteItem key={s.id} title={s.label} label={s.label} payload={{ kind: "shape", pack: s.pack, shape: s.id }} active={sameSpec(props.armed as ArmedSpec | null, { kind: "shape", pack: s.pack, shape: s.id })} onClick={() => props.onArm(s.pack, s.id)}>
            <Preview pack={s.pack} id={s.id} />
          </PaletteItem>
        ))}
      </div>
    </div>
  );
}
