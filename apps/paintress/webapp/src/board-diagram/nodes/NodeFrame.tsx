import type { ReactNode } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import type { Item } from "@shared/model";
import { useDiagramActions } from "../DiagramContext";

export interface ItemNodeData extends Record<string, unknown> {
  item: Item;
  flash?: boolean;
}
export type ItemNodeProps = NodeProps & { data: ItemNodeData };

/** Common wrapper: sizing, resize handles when selected, and the "AI just changed this" pulse. */
export function NodeFrame(props: { node: ItemNodeProps; minWidth?: number; minHeight?: number; children: ReactNode; className?: string }) {
  const { node } = props;
  const actions = useDiagramActions();
  return (
    <div className={`relative h-full w-full ${node.data.flash ? "pa-flash" : ""} ${props.className ?? ""}`}>
      <NodeResizer
        isVisible={node.selected && actions.canEdit && !node.data.item.locked}
        minWidth={props.minWidth ?? 40}
        minHeight={props.minHeight ?? 30}
        lineClassName="pa-resize-line"
        handleClassName="pa-resize-handle"
        onResizeEnd={(_e, p) => actions.resized(node.id, { x: p.x, y: p.y, width: p.width, height: p.height })}
      />
      {props.children}
    </div>
  );
}
