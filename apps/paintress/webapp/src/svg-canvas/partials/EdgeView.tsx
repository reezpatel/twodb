import { memo } from "react";
import type { Cardinality, EdgeData, Item } from "@shared/model";
import type { ItemMap } from "../../lib/item-store";
import { useCanvasTheme } from "../../lib/canvas-theme";
import { useEdgeLabel } from "../../board-diagram/hooks/useEdgeLabel";
import { arrowHead, edgeEnds, routeEdge, type Point } from "../lib/geometry";

export interface EdgeViewProps {
  item: Item;
  map: ItemMap;
  selected: boolean;
  onClick(e: React.MouseEvent, item: Item): void;
}

/** One connector: routed path, arrowheads, crow's-foot ends, label chip, step badge. */
export const EdgeView = memo(function EdgeView({ item, map, selected, onClick }: EdgeViewProps) {
  const theme = useCanvasTheme();
  const d = item.data as Partial<EdgeData>;
  const kind = (d.kind ?? "flow") as keyof typeof theme.edge;
  const stroke = selected ? theme.selected : (d.stroke ?? theme.edge[kind] ?? theme.edge.flow);
  const width = kind === "data" ? 2.6 : kind === "dep" ? 1.4 : kind === "sync" ? 1.8 : 1.6;
  const dashed = d.dashed ?? (kind === "async" || kind === "dep");

  const ends = edgeEnds(map, item);
  const edit = useEdgeLabel(item.id, d.label ?? "");
  if (!ends) return null;
  const { d: path, label: lp } = routeEdge(ends.a, ends.b, d.routing ?? "orthogonal");
  const label = d.label ?? "";

  return (
    <g data-edge={item.id} onClick={(e) => onClick(e, item)} style={{ cursor: "pointer" }}>
      {/* fat invisible hit path */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={20} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={selected ? width + 0.8 : width} strokeDasharray={dashed ? "7 5" : undefined} strokeLinecap="round" />
      {d.endCap !== "none" && <polygon points={arrowHead(ends.b.p, ends.b.dir)} fill={stroke} />}
      {d.startCap === "arrow" && <polygon points={arrowHead(ends.a.p, ends.a.dir)} fill={stroke} />}
      {d.cardinality?.from && <CrowsFoot p={ends.a.p} dir={ends.a.dir} kind={d.cardinality.from as Cardinality} stroke={stroke} fill={theme.glyphFill} />}
      {d.cardinality?.to && <CrowsFoot p={ends.b.p} dir={ends.b.dir} kind={d.cardinality.to as Cardinality} stroke={stroke} fill={theme.glyphFill} />}
      {(label || edit.editing || d.step !== undefined) && (
        <foreignObject x={lp.x - 70} y={lp.y - 14} width={140} height={28} style={{ pointerEvents: "none" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, pointerEvents: "auto" }}>
            {d.step !== undefined && (
              <span className="pa-svg-step" style={{ background: theme.dark ? theme.chipText : "#1e293b", color: theme.dark ? "#1e293b" : "#ffffff" }}>
                {d.step}
              </span>
            )}
            {edit.editing ? (
              <input
                autoFocus
                defaultValue={label}
                className="pa-svg-editor-input"
                style={{ width: 110, fontSize: 12 }}
                onBlur={(e) => edit.onCommit(e.currentTarget.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") edit.onCommit(e.currentTarget.value);
                  if (e.key === "Escape") edit.onCancel();
                }}
              />
            ) : (
              label && (
                <span
                  className="pa-svg-chip"
                  style={{ borderColor: theme.chipBorder, background: theme.chipBg, color: theme.chipText }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    edit.start();
                  }}
                >
                  {label}
                </span>
              )
            )}
          </div>
        </foreignObject>
      )}
    </g>
  );
});

/** Crow's-foot cardinality glyph at an edge end. */
function CrowsFoot({ p, dir, kind, stroke, fill }: { p: Point; dir: Point; kind: Cardinality; stroke: string; fill: string }) {
  const px = { x: -dir.y, y: dir.x };
  const u = (t: number, s = 0): Point => ({ x: p.x + dir.x * t + px.x * s, y: p.y + dir.y * t + px.y * s });
  const parts: React.ReactNode[] = [];
  if (kind === "one" || kind === "one_or_many") parts.push(<line key="bar" x1={u(10, -7).x} y1={u(10, -7).y} x2={u(10, 7).x} y2={u(10, 7).y} stroke={stroke} strokeWidth={1.6} />);
  if (kind === "many" || kind === "one_or_many" || kind === "zero_or_many")
    parts.push(<path key="foot" d={`M ${p.x} ${p.y} L ${u(14, -7).x} ${u(14, -7).y} M ${p.x} ${p.y} L ${u(14, 7).x} ${u(14, 7).y}`} stroke={stroke} strokeWidth={1.6} fill="none" />);
  if (kind === "zero_or_one" || kind === "zero_or_many") parts.push(<circle key="o" cx={u(12).x} cy={u(12).y} r={4} fill={fill} stroke={stroke} strokeWidth={1.6} />);
  return <g>{parts}</g>;
}
