import { memo } from "react";
import { getGroupStyle } from "@shared/shapes";
import { paintressClient } from "../../lib/paintress-client";
import { useDiagramActions } from "../DiagramContext";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { SideHandles } from "../partials/SideHandles";
import { InlineText } from "../partials/InlineText";
import { NodeFrame, type ItemNodeProps } from "./NodeFrame";

interface GroupData {
  kind?: string;
  title?: string;
  icon?: string;
  fill?: string;
  stroke?: string;
  dashed?: boolean;
}

/** AWS / GCP / C4 containers: a bordered region with an icon + title in the header. Children move with it. */
function GroupNodeImpl(node: ItemNodeProps) {
  const item = node.data.item;
  const d = item.data as GroupData;
  const style = getGroupStyle(d.kind ?? "plain");
  const stroke = d.stroke ?? style.stroke;
  const actions = useDiagramActions();
  const edit = useInlineEdit(d.title ?? "", (title) => actions.patch(item.id, { data: { title } }, "Rename group"), actions.canEdit);
  const icon = d.icon ?? style.icon;
  return (
    <NodeFrame node={node} minWidth={120} minHeight={80}>
      <div
        className="absolute inset-0 rounded-sm"
        style={{ border: `2px ${(d.dashed ?? style.dashed) ? "dashed" : "solid"} ${stroke}`, background: d.fill ?? style.fill }}
      />
      <div className="absolute left-0 top-0 flex h-9 max-w-full items-center gap-2 pl-2 pr-3" style={{ color: stroke }} onDoubleClick={edit.start}>
        {icon && <img src={paintressClient.iconUrl(icon)} alt="" draggable={false} className="size-6 object-contain" />}
        {edit.editing ? (
          <InlineText value={d.title ?? ""} onCommit={edit.onCommit} onCancel={edit.onCancel} style={{ width: 180, height: 26, fontSize: 13 }} />
        ) : (
          <span className="truncate text-[13px] font-semibold">{d.title}</span>
        )}
      </div>
      <SideHandles />
    </NodeFrame>
  );
}

export const GroupNode = memo(GroupNodeImpl);
