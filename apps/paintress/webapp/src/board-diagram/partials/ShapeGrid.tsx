import { SHAPES, SHAPE_PACKS } from "@shared/shapes";
import { PaletteItem } from "./PaletteItem";

function Preview({ pack, id }: { pack: string; id: string }) {
  const s = SHAPES.find((x) => x.pack === pack && x.id === id)!;
  const scale = Math.min(44 / s.w, 30 / s.h);
  const w = s.w * scale;
  const h = s.h * scale;
  return (
    <svg width={w + 4} height={h + 4} viewBox={`-2 -2 ${w + 4} ${h + 4}`}>
      <path d={s.d(w, h)} fill={s.fill ?? "#fff"} stroke={s.stroke ?? "#334155"} strokeWidth={s.heavy ? 2.5 : 1.2} />
      {s.marks && <path d={s.marks(w, h)} fill="none" stroke={s.stroke ?? "#334155"} strokeWidth={1} />}
    </svg>
  );
}

const PACK_LABEL: Record<string, string> = { basic: "Basic", flowchart: "Flowchart", bpmn: "BPMN", c4: "C4" };

export function ShapeGrid(props: { pack: string; onPack(p: string): void; onAdd(pack: string, shape: string): void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {SHAPE_PACKS.map((p) => (
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
        {SHAPES.filter((s) => s.pack === props.pack).map((s) => (
          <PaletteItem key={s.id} title={s.label} label={s.label} payload={{ kind: "shape", pack: s.pack, shape: s.id }} onClick={() => props.onAdd(s.pack, s.id)}>
            <Preview pack={s.pack} id={s.id} />
          </PaletteItem>
        ))}
      </div>
    </div>
  );
}
