import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, EyeOff, Filter, Trash2 } from "lucide-react";
import type { Field, FieldConfig, UserFieldType } from "@shared/model";
import { useGarden } from "../../lib/queries";
import { MenuButton, MenuLabel, MenuSeparator } from "../../ui/MenuButton";
import { FieldIcon, TYPE_MENU, typeLabel } from "./fieldMeta";
import { OptionsConfig } from "./config/OptionsConfig";
import { RollupConfig } from "./config/RollupConfig";
import { FormulaConfig } from "./config/FormulaConfig";
import { DatabasePicker } from "./config/DatabasePicker";

export interface FieldMenuActions {
  onSort?: (direction: "asc" | "desc") => void;
  onFilter?: () => void;
  onHide?: () => void;
  onClose?: () => void;
}

/** Everything about one field, in one popover (AFFiNE/Notion column menu). */
export function FieldMenu({ field, fields, actions, locked }: { field: Field; fields: Field[]; actions?: FieldMenuActions; locked?: boolean }) {
  const garden = useGarden();
  const [pane, setPane] = useState<"main" | "type" | "relation-target">("main");
  const [pendingType, setPendingType] = useState<UserFieldType | null>(null);
  const save = (b: { name?: string; type?: UserFieldType; config?: FieldConfig }) => void garden.patchField(field.id, b);
  const system = field.system;

  if (pane === "type")
    return (
      <div className="w-[230px] p-1">
        <MenuButton icon={<ChevronLeft size={14} />} onClick={() => setPane("main")}>
          Change type
        </MenuButton>
        <MenuSeparator />
        {TYPE_MENU.map((g) => (
          <div key={g.group}>
            <MenuLabel>{g.group}</MenuLabel>
            {g.types.map((t) => (
              <MenuButton
                key={t}
                icon={<FieldIcon type={t} />}
                active={t === field.type}
                onClick={() => {
                  if (t === field.type) return setPane("main");
                  if (t === "relation") {
                    setPendingType(t);
                    return setPane("relation-target");
                  }
                  save({ type: t });
                  setPane("main");
                }}
              >
                {typeLabel(t)}
              </MenuButton>
            ))}
          </div>
        ))}
      </div>
    );

  if (pane === "relation-target")
    return (
      <DatabasePicker
        onPick={(databaseId) => {
          if (pendingType) save({ type: pendingType, config: { relation: { databaseId } } });
          setPane("main");
        }}
      />
    );

  return (
    <div className="w-[260px] p-1">
      <div className="flex items-center gap-1.5 p-1">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-outline">
          <FieldIcon type={field.type} />
        </span>
        <input
          autoFocus={!system}
          disabled={system && field.id !== "title"}
          defaultValue={field.name}
          onBlur={(e) => !system && e.target.value.trim() && e.target.value.trim() !== field.name && save({ name: e.target.value.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-7 min-w-0 flex-1 rounded-md border border-outline bg-paper px-2 text-[13px] outline-none focus:border-ion-deep disabled:opacity-70"
        />
      </div>
      {!system && !locked ? (
        <MenuButton icon={<FieldIcon type={field.type} />} trailing={<span className="inline-flex items-center gap-0.5">{typeLabel(field.type)} <ChevronRight size={12} /></span>} onClick={() => setPane("type")}>
          Type
        </MenuButton>
      ) : (
        <div className="px-2 py-1 text-[12px] text-ink-muted">{typeLabel(field.type)} · built-in</div>
      )}

      {!locked && (field.type === "select" || field.type === "multi_select" || field.type === "status") ? (
        <OptionsConfig field={field} onSave={(options) => save({ config: { ...field.config, options } })} />
      ) : null}
      {!locked && field.type === "number" ? (
        <div className="px-2 py-1">
          <select
            value={field.config.number?.format ?? "number"}
            onChange={(e) => save({ config: { ...field.config, number: { ...field.config.number, format: e.target.value as "number" } } })}
            className="h-7 w-full rounded-md border border-outline bg-paper px-1.5 text-[13px] outline-none"
          >
            <option value="number">Number</option>
            <option value="integer">Integer</option>
            <option value="percent">Percent</option>
            <option value="currency">Currency</option>
          </select>
        </div>
      ) : null}
      {!locked && field.type === "date" ? (
        <label className="flex items-center justify-between px-2 py-1.5 text-[13px]">
          Include time
          <input type="checkbox" checked={!!field.config.date?.includeTime} onChange={(e) => save({ config: { ...field.config, date: { includeTime: e.target.checked } } })} className="accent-[var(--ion-deep)]" />
        </label>
      ) : null}
      {!locked && field.type === "relation" ? (
        <div className="px-2 py-1 text-[12.5px] text-ink-muted">
          {field.config.relation?.reverseFieldId ? "Two-way relation" : "One-way relation"}
          <label className="mt-1 flex items-center justify-between text-[13px] text-ink">
            Limit to one page
            <input
              type="checkbox"
              checked={!!field.config.relation?.limitOne}
              onChange={(e) => save({ config: { ...field.config, relation: { ...field.config.relation!, limitOne: e.target.checked } } })}
              className="accent-[var(--ion-deep)]"
            />
          </label>
        </div>
      ) : null}
      {!locked && field.type === "rollup" ? <RollupConfig field={field} fields={fields} onSave={(config) => save({ config })} /> : null}
      {!locked && field.type === "formula" ? <FormulaConfig field={field} fields={fields} onSave={(config) => save({ config })} /> : null}

      {actions?.onSort || actions?.onFilter || actions?.onHide ? <MenuSeparator /> : null}
      {actions?.onSort ? (
        <>
          <MenuButton icon={<ArrowUp size={14} />} onClick={() => (actions.onSort!("asc"), actions.onClose?.())}>
            Sort ascending
          </MenuButton>
          <MenuButton icon={<ArrowDown size={14} />} onClick={() => (actions.onSort!("desc"), actions.onClose?.())}>
            Sort descending
          </MenuButton>
        </>
      ) : null}
      {actions?.onFilter ? (
        <MenuButton icon={<Filter size={14} />} onClick={() => (actions.onFilter!(), actions.onClose?.())}>
          Filter
        </MenuButton>
      ) : null}
      {actions?.onHide && field.id !== "title" ? (
        <MenuButton icon={<EyeOff size={14} />} onClick={() => (actions.onHide!(), actions.onClose?.())}>
          Hide in view
        </MenuButton>
      ) : null}
      {!system && !locked ? (
        <>
          <MenuSeparator />
          <MenuButton
            danger
            icon={<Trash2 size={14} />}
            onClick={() => {
              if (window.confirm(`Delete property “${field.name}”? Its values are removed from every page.`)) {
                void garden.deleteField(field.id);
                actions?.onClose?.();
              }
            }}
          >
            Delete property
          </MenuButton>
        </>
      ) : null}
    </div>
  );
}
