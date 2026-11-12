import { memo } from "react";
import { useDiagramActions } from "../DiagramContext";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { InlineText } from "../partials/InlineText";
import { NodeFrame, type ItemNodeProps } from "./NodeFrame";

/** Swimlane pool: the outer frame; its lanes are child items. Title runs down the left gutter. */
function PoolNodeImpl(node: ItemNodeProps) {
  const item = node.data.item;
  const title = (item.data as { title?: string }).title ?? "";
  const actions = useDiagramActions();
  const edit = useInlineEdit(title, (t) => actions.patch(item.id, { data: { title: t } }, "Rename pool"), actions.canEdit);
  return (
    <NodeFrame node={node} minWidth={200} minHeight={120}>
      <div className="absolute inset-0 rounded-sm border-2 border-slate-600 bg-white/40" />
      <div className="absolute left-0 top-0 flex h-full w-9 items-center justify-center border-r-2 border-slate-600 bg-slate-100" onDoubleClick={edit.start}>
        {edit.editing ? (
          <InlineText value={title} onCommit={edit.onCommit} onCancel={edit.onCancel} style={{ width: 120, height: 28, fontSize: 13 }} />
        ) : (
          <span className="pa-vertical text-[13px] font-bold text-slate-700">{title}</span>
        )}
      </div>
    </NodeFrame>
  );
}

export const PoolNode = memo(PoolNodeImpl);
