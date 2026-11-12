import { memo } from "react";
import { useDiagramActions } from "../DiagramContext";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { InlineText } from "../partials/InlineText";
import { NodeFrame, type ItemNodeProps } from "./NodeFrame";

/** One swimlane band inside a pool. Steps placed over it become its children and move with it. */
function LaneNodeImpl(node: ItemNodeProps) {
  const item = node.data.item;
  const d = item.data as { title?: string; fill?: string };
  const actions = useDiagramActions();
  const edit = useInlineEdit(d.title ?? "", (t) => actions.patch(item.id, { data: { title: t } }, "Rename lane"), actions.canEdit);
  return (
    <NodeFrame node={node} minWidth={200} minHeight={80}>
      <div className="absolute inset-0 border-b-2 border-slate-400" style={{ background: d.fill ?? "rgba(148,163,184,0.06)" }} />
      <div className="absolute -left-9 top-0 flex h-full w-9 items-center justify-center border-r border-slate-400 bg-slate-50" onDoubleClick={edit.start}>
        {edit.editing ? (
          <InlineText value={d.title ?? ""} onCommit={edit.onCommit} onCancel={edit.onCancel} style={{ width: 120, height: 28, fontSize: 12 }} />
        ) : (
          <span className="pa-vertical max-h-full truncate text-xs font-semibold text-slate-600">{d.title}</span>
        )}
      </div>
    </NodeFrame>
  );
}

export const LaneNode = memo(LaneNodeImpl);
