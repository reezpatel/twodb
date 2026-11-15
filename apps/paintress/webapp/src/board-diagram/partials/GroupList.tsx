import { GROUP_STYLES } from "@shared/shapes";
import { useCanvasTheme, visibleStroke } from "../../lib/canvas-theme";
import { sameSpec, type ArmedSpec } from "../hooks/usePlacement";
import { paintressClient } from "../../lib/paintress-client";
import { PaletteItem } from "./PaletteItem";

const TITLES: Record<string, string> = { basic: "General", c4: "C4", aws: "AWS", gcp: "Google Cloud" };

/** AWS / GCP / C4 containers — drop one on the canvas, then drop services inside it. */
export function GroupList(props: { armed: unknown; onArm(styleId: string): void }) {
  const theme = useCanvasTheme();
  const packs = [...new Set(GROUP_STYLES.map((g) => g.pack))];
  return (
    <div className="flex flex-col gap-3">
      {packs.map((pack) => (
        <div key={pack}>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{TITLES[pack]}</div>
          <div className="grid grid-cols-2 gap-1">
            {GROUP_STYLES.filter((g) => g.pack === pack).map((g) => (
              <PaletteItem key={g.id} title={g.label} payload={{ kind: "group", style: g.id }} active={sameSpec(props.armed as ArmedSpec | null, { kind: "group", style: g.id })} onClick={() => props.onArm(g.id)}>
                <div className="flex h-9 w-full items-center gap-1.5 rounded-sm px-1.5 text-[11px] font-semibold" style={{ border: `2px ${g.dashed ? "dashed" : "solid"} ${visibleStroke(g.stroke, theme)}`, color: visibleStroke(g.stroke, theme), background: g.fill }}>
                  {g.icon && <img src={paintressClient.iconUrl(g.icon)} alt="" className="size-4" />}
                  <span className="truncate">{g.label}</span>
                </div>
              </PaletteItem>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
