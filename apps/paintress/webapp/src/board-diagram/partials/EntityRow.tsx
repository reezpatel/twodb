import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { X } from "lucide-react";
import type { Column } from "@shared/model";
import { LAYOUT } from "@shared/shapes";

/** One ERD table row. Both sides carry connection points, so relation lines attach to this exact column. */
export function EntityRow(props: {
  column: Column;
  editing: boolean;
  canEdit: boolean;
  onStartEdit(): void;
  onCommit(patch: Partial<Column>): void;
  onCancel(): void;
  onRemove(): void;
  onTogglePk(): void;
}) {
  const { column: c } = props;
  const [name, setName] = useState(c.name);
  const [type, setType] = useState(c.type);
  const commit = () => props.onCommit({ name: name.trim() || c.name, type });
  const key = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") commit();
    if (e.key === "Escape") props.onCancel();
  };
  return (
    <div className="group/row relative flex items-center gap-1.5 border-t border-slate-200 px-2 text-[12px]" style={{ height: LAYOUT.entityRowH }} onDoubleClick={props.onStartEdit}>
      <Handle id={`${c.id}:l`} type="source" position={Position.Left} className="pa-handle" />
      <Handle id={`${c.id}:l`} type="target" position={Position.Left} className="pa-handle pa-handle-target" />
      <Handle id={`${c.id}:r`} type="source" position={Position.Right} className="pa-handle" />
      <Handle id={`${c.id}:r`} type="target" position={Position.Right} className="pa-handle pa-handle-target" />
      <button
        type="button"
        onClick={props.onTogglePk}
        className={`nodrag w-6 shrink-0 text-left text-[10px] font-bold ${c.pk ? "text-amber-600" : c.fk ? "text-sky-600" : "text-transparent hover:text-slate-400"}`}
        title="Toggle primary key"
      >
        {c.pk ? "PK" : c.fk ? "FK" : "PK"}
      </button>
      {props.editing ? (
        <>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={key} className="nodrag nopan w-24 rounded-sm border border-ion-deep px-1 text-[12px] outline-none" />
          <input value={type} onChange={(e) => setType(e.target.value)} onKeyDown={key} onBlur={commit} className="nodrag nopan w-16 rounded-sm border border-ion-deep px-1 text-[12px] outline-none" />
        </>
      ) : (
        <>
          <span className={`truncate font-medium ${c.nullable ? "text-slate-500" : "text-slate-900"}`}>{c.name}</span>
          <span className="ml-auto truncate pl-2 text-slate-500">{c.type}</span>
        </>
      )}
      {props.canEdit && !props.editing && (
        <button type="button" onClick={props.onRemove} className="nodrag absolute right-0.5 hidden rounded-full bg-white p-0.5 text-slate-400 hover:text-red-600 group-hover/row:block" aria-label={`Remove ${c.name}`}>
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
