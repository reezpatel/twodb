import { memo } from "react";
import { getShape } from "@shared/shapes";
import { paintressClient } from "../../lib/paintress-client";
import { useDiagramActions } from "../DiagramContext";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { ShapeSvg } from "../shapes/ShapeSvg";
import { SideHandles } from "../partials/SideHandles";
import { InlineText } from "../partials/InlineText";
import { NodeFrame, type ItemNodeProps } from "./NodeFrame";

interface ShapeData {
  pack?: string;
  shape?: string;
  text?: string;
  sublabel?: string;
  icon?: string;
  fill?: string;
  stroke?: string;
  dashed?: boolean;
  fontSize?: number;
}

/** Flowchart / BPMN / C4 / basic shapes and icon cards (services, databases, users…). */
function ShapeNodeImpl(node: ItemNodeProps) {
  const item = node.data.item;
  const d = item.data as ShapeData;
  const def = getShape(d.pack ?? "basic", d.shape ?? "rectangle");
  const actions = useDiagramActions();
  const edit = useInlineEdit(d.text ?? "", (text) => actions.patch(item.id, { data: { text } }, "Edit text"), actions.canEdit);
  const dark = def.fill && def.fill !== "#ffffff" && !def.fill.startsWith("#fff");
  const color = dark ? "#ffffff" : "#0f172a";
  const iconCard = def.id === "icon-card";
  const w = item.width || def.w;
  const h = item.height || def.h;

  const label = edit.editing ? (
    <InlineText value={d.text ?? ""} onCommit={edit.onCommit} onCancel={edit.onCancel} style={{ width: Math.max(80, w - 16), minHeight: 40, fontSize: 13 }} />
  ) : (
    <div className="whitespace-pre-wrap break-words text-center leading-tight" style={{ fontSize: d.fontSize ?? 13, color }}>
      {d.text}
      {d.sublabel && <div className="mt-0.5 text-[11px] opacity-70">{d.sublabel}</div>}
    </div>
  );

  return (
    <NodeFrame node={node} minWidth={40} minHeight={30}>
      <ShapeSvg pack={def.pack} shape={def.id} width={w} height={h} fill={d.fill} stroke={d.stroke} dashed={d.dashed} />
      <div className="absolute inset-0 flex items-center justify-center p-2" onDoubleClick={edit.start}>
        {def.labelBelow ? null : iconCard ? (
          <div className="flex min-w-0 flex-col items-center gap-1">
            {d.icon && <img src={paintressClient.iconUrl(d.icon)} alt="" draggable={false} className="size-9 object-contain" />}
            {label}
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            {d.icon && <img src={paintressClient.iconUrl(d.icon)} alt="" draggable={false} className="size-7 shrink-0 object-contain" />}
            {label}
          </div>
        )}
      </div>
      {def.labelBelow && (
        <div className="absolute left-1/2 top-full mt-1 w-40 -translate-x-1/2" onDoubleClick={edit.start}>
          {label}
        </div>
      )}
      <SideHandles />
    </NodeFrame>
  );
}

export const ShapeNode = memo(ShapeNodeImpl);
