import { memo } from "react";
import { useDiagramActions } from "../DiagramContext";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { InlineText } from "../partials/InlineText";
import { SideHandles } from "../partials/SideHandles";
import { NodeFrame, type ItemNodeProps } from "./NodeFrame";

function StickyNodeImpl(node: ItemNodeProps) {
  const item = node.data.item;
  const d = item.data as { text?: string; color?: string };
  const actions = useDiagramActions();
  const edit = useInlineEdit(d.text ?? "", (text) => actions.patch(item.id, { data: { text } }, "Edit note"), actions.canEdit);
  return (
    <NodeFrame node={node} minWidth={80} minHeight={60}>
      <div className="absolute inset-0 flex items-start rounded-sm p-3 shadow-md" style={{ background: d.color ?? "#fde68a" }} onDoubleClick={edit.start}>
        {edit.editing ? (
          <InlineText value={d.text ?? ""} onCommit={edit.onCommit} onCancel={edit.onCancel} className="h-full w-full !bg-transparent !text-left" style={{ fontSize: 15 }} />
        ) : (
          <div className="whitespace-pre-wrap break-words text-[15px] leading-snug text-slate-900">{d.text}</div>
        )}
      </div>
      <SideHandles />
    </NodeFrame>
  );
}

export const StickyNode = memo(StickyNodeImpl);
