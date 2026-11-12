import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Plus } from "lucide-react";
import type { Column } from "@shared/model";
import { LAYOUT } from "@shared/shapes";
import { useEntityEdit } from "../hooks/useEntityEdit";
import { EntityRow } from "../partials/EntityRow";
import { InlineText } from "../partials/InlineText";
import { NodeFrame, type ItemNodeProps } from "./NodeFrame";

/** ERD table: header + one row per column, each row its own connection point. */
function EntityNodeImpl(node: ItemNodeProps) {
  const item = node.data.item;
  const d = item.data as { name?: string; columns?: Column[]; color?: string };
  const columns = d.columns ?? [];
  const e = useEntityEdit(item.id, columns, d.name ?? "");
  return (
    <NodeFrame node={node} minWidth={180} minHeight={LAYOUT.entityHeaderH + LAYOUT.entityRowH}>
      <div className="absolute inset-0 overflow-visible rounded-md border border-slate-400 bg-white shadow-sm">
        <div className="relative flex items-center rounded-t-md px-3 text-[13px] font-bold text-white" style={{ height: LAYOUT.entityHeaderH, background: d.color ?? "#4f63ad" }} onDoubleClick={e.startName}>
          <Handle id="t" type="source" position={Position.Top} className="pa-handle" />
          <Handle id="t" type="target" position={Position.Top} className="pa-handle pa-handle-target" />
          {e.editingName ? (
            <InlineText value={d.name ?? ""} onCommit={e.commitName} onCancel={e.cancelName} className="!text-slate-900" style={{ width: 160, height: 26, fontSize: 13 }} />
          ) : (
            <span className="truncate">{d.name}</span>
          )}
        </div>
        {columns.map((c) => (
          <EntityRow
            key={c.id}
            column={c}
            editing={e.editingRow === c.id}
            canEdit={e.canEdit}
            onStartEdit={() => e.startRow(c.id)}
            onCommit={(p) => e.updateRow(c.id, p)}
            onCancel={e.stopRow}
            onRemove={() => e.removeRow(c.id)}
            onTogglePk={() => e.canEdit && e.togglePk(c.id)}
          />
        ))}
        {e.canEdit && node.selected && (
          <button type="button" onClick={e.addRow} className="nodrag absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600 shadow-sm hover:bg-slate-50">
            <Plus className="size-3" /> column
          </button>
        )}
      </div>
    </NodeFrame>
  );
}

export const EntityNode = memo(EntityNodeImpl);
