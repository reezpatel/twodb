import { useState } from "react";
import { Eye, EyeOff, GripVertical, Plus } from "lucide-react";
import type { DatabaseViewModel } from "../hooks/useDatabaseView";
import { withFieldOrder } from "../lib/view-utils";
import { FieldIcon } from "../fields/fieldMeta";
import { AddFieldMenu } from "../fields/AddFieldMenu";
import { Popover } from "../../ui/Popover";

/** Show/hide + drag-reorder fields for the current view. */
export function PropertiesPopover({ m }: { m: DatabaseViewModel }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  if (!m.view) return null;
  const view = m.view;
  const ids = m.vfields.map((v) => v.field.id);
  const drop = (target: string) => {
    if (!drag || drag === target) return;
    const next = ids.filter((id) => id !== drag);
    next.splice(next.indexOf(target), 0, drag);
    void m.garden.patchView(view.databaseId, view.id, { config: withFieldOrder(view, m.fields, next) });
  };
  return (
    <div className="w-[260px] p-1">
      <div className="max-h-[360px] overflow-y-auto">
        {m.vfields.map(({ field, hidden }) => (
          <div
            key={field.id}
            draggable={field.id !== "title"}
            onDragStart={() => setDrag(field.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => (drop(field.id), setDrag(null))}
            className="group flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] hover:bg-ink/[0.04]"
          >
            <GripVertical size={13} className={field.id === "title" ? "opacity-0" : "cursor-grab text-ink-muted/60"} />
            <FieldIcon type={field.type} />
            <span className={`min-w-0 flex-1 truncate ${hidden ? "text-ink-muted" : ""}`}>{field.name}</span>
            {field.id !== "title" ? (
              <button type="button" onClick={() => void m.setFieldSetting(field.id, { hidden: !hidden })} className="text-ink-muted hover:text-ink" aria-label={hidden ? "Show" : "Hide"}>
                {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-1 border-t border-outline pt-1">
        <Popover
          open={adding}
          onOpenChange={setAdding}
          side="right"
          trigger={
            <button type="button" className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-ink-muted hover:bg-ink/[0.06] hover:text-ink">
              <Plus size={14} /> New property
            </button>
          }
        >
          <AddFieldMenu databaseId={view.databaseId} onCreated={(f) => (setAdding(false), void m.setFieldSetting(f.id, { hidden: false }))} />
        </Popover>
      </div>
    </div>
  );
}
