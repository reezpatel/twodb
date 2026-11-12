import { memo } from "react";
import { useDiagramActions } from "../DiagramContext";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { InlineText } from "../partials/InlineText";
import { NodeFrame, type ItemNodeProps } from "./NodeFrame";

function TextNodeImpl(node: ItemNodeProps) {
  const item = node.data.item;
  const d = item.data as { text?: string; fontSize?: number; color?: string; align?: "left" | "center" | "right" };
  const actions = useDiagramActions();
  const edit = useInlineEdit(d.text ?? "", (text) => actions.patch(item.id, { data: { text } }, "Edit text"), actions.canEdit);
  return (
    <NodeFrame node={node} minWidth={40} minHeight={20}>
      <div className="absolute inset-0 flex items-center" style={{ justifyContent: d.align === "center" ? "center" : d.align === "right" ? "flex-end" : "flex-start" }} onDoubleClick={edit.start}>
        {edit.editing ? (
          <InlineText value={d.text ?? ""} onCommit={edit.onCommit} onCancel={edit.onCancel} className="h-full w-full !text-left" style={{ fontSize: d.fontSize ?? 16 }} />
        ) : (
          <div className="whitespace-pre-wrap break-words px-1 font-medium" style={{ fontSize: d.fontSize ?? 16, color: d.color ?? "#0f172a", textAlign: d.align ?? "left" }}>
            {d.text || <span className="text-slate-400">Text</span>}
          </div>
        )}
      </div>
    </NodeFrame>
  );
}

export const TextNode = memo(TextNodeImpl);
