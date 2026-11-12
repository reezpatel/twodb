import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { useNavigate } from "react-router";
import type { Field, RecordDetail } from "@shared/model";
import { cn } from "@twodb/blocks";
import { useGarden } from "../../lib/queries";
import { usePeek } from "../../lib/usePeek";
import { Popover } from "../../ui/Popover";
import { RecordIcon } from "../../ui/RecordIcon";
import { FieldIcon } from "../../database/fields/fieldMeta";
import { FieldMenu } from "../../database/fields/FieldMenu";
import { AddFieldMenu } from "../../database/fields/AddFieldMenu";
import { PropertyValue } from "../../database/fields/PropertyValue";

const HIDDEN = new Set(["title", "created_by"]);

/** Collapsible property sheet: the page's database fields + values (every page lives in a database). */
export function PropertiesPanel({ record, defaultOpen = true }: { record: RecordDetail; defaultOpen?: boolean }) {
  const garden = useGarden();
  const navigate = useNavigate();
  const { openPeek } = usePeek();
  const [open, setOpen] = useState(defaultOpen);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const fields = (record.fields ?? []).filter((f) => !HIDDEN.has(f.id));
  const parentDb = record.ancestors.at(-1)?.kind === "database" ? record.ancestors.at(-1) : null;
  const valueOf = (f: Field) => (f.id === "created_time" ? record.createdAt : f.id === "updated_time" ? record.updatedAt : record.values?.[f.id]);

  return (
    <div className="mt-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-7 items-center gap-1 rounded-md pr-2 text-[13px] font-medium text-ink-muted hover:text-ink">
        <ChevronRight size={14} className={cn("transition-transform", open && "rotate-90")} />
        Properties
        {!open ? <span className="text-[12px] font-normal">· {fields.length}</span> : null}
      </button>
      {open ? (
        <div className="mt-1 space-y-px">
          {parentDb ? (
            <div className="flex min-h-[30px] items-center">
              <div className="w-[160px] shrink-0 px-2 text-[13px] text-ink-muted">Database</div>
              <button type="button" onClick={() => navigate(`/${parentDb.id}`)} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13.5px] hover:bg-ink/[0.05]">
                <RecordIcon icon={parentDb.icon} kind="database" size={14} /> {parentDb.title || "Untitled"}
              </button>
            </div>
          ) : null}
          {fields.map((f) => (
            <div key={f.id} className="flex items-start">
              <Popover
                open={menu === f.id}
                onOpenChange={(o) => setMenu(o ? f.id : null)}
                trigger={
                  <button type="button" className="flex h-[30px] w-[160px] shrink-0 items-center gap-1.5 rounded-md px-2 text-left text-[13px] text-ink-muted hover:bg-ink/[0.05]">
                    <FieldIcon type={f.type} size={14} />
                    <span className="truncate">{f.name}</span>
                  </button>
                }
              >
                <FieldMenu field={f} fields={record.fields ?? []} actions={{ onClose: () => setMenu(null) }} />
              </Popover>
              <div className="min-w-0 flex-1">
                <PropertyValue
                  field={f}
                  value={valueOf(f)}
                  relations={record.relations}
                  variant="panel"
                  onOpenRecord={openPeek}
                  onChange={(v) => void garden.setValues(record.id, { [f.id]: v })}
                />
              </div>
            </div>
          ))}
          {record.databaseId && !record.deletedAt ? (
            <Popover
              open={adding}
              onOpenChange={setAdding}
              trigger={
                <button type="button" className="flex h-[30px] items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-muted hover:bg-ink/[0.05] hover:text-ink">
                  <Plus size={14} /> Add property
                </button>
              }
            >
              <AddFieldMenu databaseId={record.databaseId} onCreated={(f) => (setAdding(false), setMenu(f.id))} />
            </Popover>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
