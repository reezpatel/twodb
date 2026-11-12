import type { Field, ViewConfig } from "@shared/model";
import { MenuButton, MenuLabel, MenuSeparator } from "../../ui/MenuButton";
import { FieldIcon } from "../fields/fieldMeta";
import { GROUPABLE } from "../lib/view-utils";

export function GroupPopover({ fields, groupBy, onSave, required }: { fields: Field[]; groupBy: ViewConfig["groupBy"]; onSave: (g: ViewConfig["groupBy"]) => void; required?: boolean }) {
  const candidates = fields.filter((f) => GROUPABLE.has(f.type));
  return (
    <div className="w-[240px] p-1">
      <MenuLabel>Group by</MenuLabel>
      {!required ? (
        <MenuButton active={!groupBy} onClick={() => onSave(null)}>
          None
        </MenuButton>
      ) : null}
      {candidates.map((f) => (
        <MenuButton key={f.id} icon={<FieldIcon type={f.type} />} active={groupBy?.fieldId === f.id} onClick={() => onSave({ fieldId: f.id, hideEmpty: groupBy?.hideEmpty })}>
          {f.name}
        </MenuButton>
      ))}
      {groupBy ? (
        <>
          <MenuSeparator />
          <label className="flex items-center justify-between px-2 py-1.5 text-[13px]">
            Hide empty groups
            <input type="checkbox" checked={!!groupBy.hideEmpty} onChange={(e) => onSave({ ...groupBy, hideEmpty: e.target.checked })} className="accent-[var(--ion-deep)]" />
          </label>
        </>
      ) : null}
      {!candidates.length ? <p className="px-2 py-1.5 text-[12.5px] text-ink-muted">Add a select, status or checkbox property to group by.</p> : null}
    </div>
  );
}
