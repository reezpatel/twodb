import { memo } from "react";
import { getGroupStyle, getShape } from "@shared/shapes";
import { paintressClient } from "../../lib/paintress-client";
import { useCanvasTheme, visibleStroke } from "../../lib/canvas-theme";
import type { ArmedSpec } from "../../board-diagram/hooks/usePlacement";

/**
 * The ghost that follows the cursor while an item is armed: shows exactly what
 * will be created (shape outline, icon card, sticky colour, ERD table…) at the
 * size it will get from a bare click. Faded so the canvas stays readable.
 */
export const ArmedPreview = memo(function ArmedPreview({ spec, at }: { spec: ArmedSpec; at: { x: number; y: number } }) {
  const theme = useCanvasTheme();
  let body: React.ReactNode = null;
  let w = 160;
  let h = 90;

  switch (spec.kind) {
    case "shape": {
      const def = getShape(spec.pack, spec.shape);
      w = def.w;
      h = def.h;
      const stroke = visibleStroke(def.stroke ?? theme.shapeStroke, theme);
      body = (
        <>
          <path d={def.d(w, h)} style={{ fill: def.fill ?? theme.shapeFill, stroke, strokeWidth: def.heavy ? 3.5 : 1.5 }} strokeLinejoin="round" />
          {def.marks && <path d={def.marks(w, h)} fill="none" style={{ stroke, strokeWidth: 1.2 }} />}
          <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill={theme.shapeText} className="pa-svg-text">
            {def.label === "Rectangle" ? "" : def.label}
          </text>
        </>
      );
      break;
    }
    case "group": {
      const g = getGroupStyle(spec.style);
      w = 420;
      h = 300;
      const stroke = visibleStroke(g.stroke, theme);
      body = (
        <>
          <rect width={w} height={h} rx={6} style={{ fill: g.fill, stroke, strokeWidth: 2 }} strokeDasharray={g.dashed ? "8 6" : undefined} />
          {g.icon && <image href={paintressClient.iconUrl(g.icon)} x={8} y={8} width={22} height={22} />}
          <text x={g.icon ? 36 : 10} y={19} dominantBaseline="middle" fontSize={13} fontWeight={600} fill={stroke} className="pa-svg-text">
            {g.label}
          </text>
        </>
      );
      break;
    }
    case "icon": {
      w = 120;
      h = 100;
      body = (
        <>
          <rect width={w} height={h} rx={10} style={{ fill: theme.shapeFill, stroke: theme.shapeStroke, strokeWidth: 1.5 }} />
          <image href={paintressClient.iconUrl(spec.icon)} x={w / 2 - 16} y={Math.max(6, h / 2 - 30)} width={32} height={32} />
          <text x={w / 2} y={h / 2 + 16} textAnchor="middle" fontSize={13} fill={theme.shapeText} className="pa-svg-text">
            {spec.label}
          </text>
        </>
      );
      break;
    }
    case "entity": {
      w = 240;
      h = 88;
      body = (
        <>
          <rect width={w} height={h} rx={8} style={{ fill: theme.cardBg, stroke: theme.cardBorder, strokeWidth: 1.5 }} className="pa-svg-entity" />
          <rect width={w} height={32} rx={8} fill={theme.dark ? "#3b4048" : "#4f63ad"} />
          <rect y={24} width={w} height={8} fill={theme.dark ? "#3b4048" : "#4f63ad"} />
          <text x={12} y={20} fontSize={13} fontWeight={700} fill="#ffffff" className="pa-svg-text">
            table
          </text>
          <text x={12} y={48} fontSize={12} fill={theme.shapeText} className="pa-svg-text">
            id
          </text>
          <text x={12} y={72} fontSize={12} fill={theme.shapeText} className="pa-svg-text">
            name
          </text>
        </>
      );
      break;
    }
    case "pool": {
      w = 520;
      h = 320;
      body = (
        <>
          <rect width={w} height={h} rx={4} fill={theme.dark ? "rgba(53,53,53,0.35)" : "rgba(255,255,255,0.4)"} stroke={theme.poolBorder} strokeWidth={2} />
          <rect width={36} height={h} fill={theme.laneTitleBg} stroke={theme.poolBorder} strokeWidth={2} rx={4} />
        </>
      );
      break;
    }
    case "sticky": {
      w = 180;
      h = 180;
      body = <rect width={w} height={h} rx={3} fill={spec.color ?? "#fde68a"} className="pa-svg-sticky" />;
      break;
    }
    case "text": {
      w = 220;
      h = 40;
      body = (
        <text x={0} y={24} fontSize={18} fontWeight={500} fill={theme.shapeText} className="pa-svg-text">
          Text
        </text>
      );
      break;
    }
  }

  return (
    <g transform={`translate(${at.x - w / 2}, ${at.y - h / 2})`} opacity={0.55} pointerEvents="none" className="pa-svg-preview" data-w={w} data-h={h}>
      {body}
    </g>
  );
});
