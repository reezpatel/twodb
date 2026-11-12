import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, Position, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps } from "@xyflow/react";
import type { Cardinality, EdgeData, Item } from "@shared/model";
import { CardinalityGlyph } from "../partials/CardinalityGlyph";
import { InlineText } from "../partials/InlineText";
import { useEdgeLabel } from "../hooks/useEdgeLabel";

const SIDE = { [Position.Right]: "right", [Position.Bottom]: "bottom", [Position.Left]: "left", [Position.Top]: "top" } as const;

const KIND_STYLE: Record<string, { stroke: string; width: number; dashed?: boolean }> = {
  flow: { stroke: "#475569", width: 1.6 },
  sync: { stroke: "#2563eb", width: 1.8 },
  async: { stroke: "#7c3aed", width: 1.6, dashed: true },
  data: { stroke: "#059669", width: 2.6 },
  dep: { stroke: "#94a3b8", width: 1.4, dashed: true },
  relation: { stroke: "#334155", width: 1.5 },
};

type SmartEdgeProps = EdgeProps & { data?: { item: Item } };

/** Orthogonal / straight / curved connector with label, numbered step badge, arrow caps and crow's-foot ends. */
function SmartEdgeImpl(p: SmartEdgeProps) {
  const item = p.data?.item;
  const d = (item?.data ?? {}) as Partial<EdgeData>;
  const kind = KIND_STYLE[d.kind ?? "flow"] ?? KIND_STYLE.flow!;
  const stroke = p.selected ? "#4f63ad" : (d.stroke ?? kind.stroke);
  const dashed = d.dashed ?? kind.dashed;
  const args = { sourceX: p.sourceX, sourceY: p.sourceY, targetX: p.targetX, targetY: p.targetY, sourcePosition: p.sourcePosition, targetPosition: p.targetPosition };
  const [path, lx, ly] =
    d.routing === "straight" ? getStraightPath(args) : d.routing === "bezier" ? getBezierPath(args) : getSmoothStepPath({ ...args, borderRadius: 8, offset: 24 });
  const label = d.label ?? "";
  const edit = useEdgeLabel(item?.id ?? "", label);
  const card = d.cardinality;
  const showLabel = label || edit.editing;

  return (
    <>
      <BaseEdge
        id={p.id}
        path={path}
        interactionWidth={20}
        markerStart={d.startCap === "arrow" ? p.markerStart : undefined}
        markerEnd={d.endCap === "none" ? undefined : p.markerEnd}
        style={{ stroke, strokeWidth: kind.width, strokeDasharray: dashed ? "7 5" : undefined }}
      />
      {card?.from && <CardinalityGlyph x={p.sourceX} y={p.sourceY} side={SIDE[p.sourcePosition]} kind={card.from as Cardinality} stroke={stroke} />}
      {card?.to && <CardinalityGlyph x={p.targetX} y={p.targetY} side={SIDE[p.targetPosition]} kind={card.to as Cardinality} stroke={stroke} />}
      {(showLabel || d.step !== undefined) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
            onDoubleClick={edit.start}
          >
            {d.step !== undefined && (
              <span className="flex size-5 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">{d.step}</span>
            )}
            {edit.editing ? (
              <InlineText value={label} onCommit={edit.onCommit} onCancel={edit.onCancel} style={{ width: 120, height: 28, fontSize: 12 }} />
            ) : (
              label && <span className="rounded-sm border border-slate-200 bg-white/95 px-1.5 py-0.5 text-[11px] text-slate-700">{label}</span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const SmartEdge = memo(SmartEdgeImpl);
