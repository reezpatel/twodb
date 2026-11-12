import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { Field, UserFieldType } from "@shared/model";
import { useGarden } from "../../lib/queries";
import { MenuButton, MenuLabel, MenuSeparator } from "../../ui/MenuButton";
import { FieldIcon, TYPE_MENU, typeLabel } from "./fieldMeta";
import { DatabasePicker } from "./config/DatabasePicker";

/** "+ Add property": pick a type (relation → pick target + two-way), creates the field and reports it. */
export function AddFieldMenu({ databaseId, onCreated }: { databaseId: string; onCreated?: (f: Field) => void }) {
  const garden = useGarden();
  const [step, setStep] = useState<"type" | "target" | "relation">("type");
  const [target, setTarget] = useState<{ id: string; title: string } | null>(null);
  const [twoWay, setTwoWay] = useState(true);

  const create = async (type: UserFieldType, extra: Parameters<typeof garden.createField>[1] extends infer B ? Partial<B> : never = {}) => {
    const f = await garden.createField(databaseId, { name: typeLabel(type), type, ...extra });
    onCreated?.(f);
  };

  if (step === "target")
    return (
      <div>
        <div className="p-1">
          <MenuButton icon={<ChevronLeft size={14} />} onClick={() => setStep("type")}>
            Relation to…
          </MenuButton>
        </div>
        <DatabasePicker
          onPick={(id, title) => {
            setTarget({ id, title });
            setStep("relation");
          }}
        />
      </div>
    );

  if (step === "relation" && target)
    return (
      <div className="w-[260px] space-y-2 p-3 text-[13px]">
        <div>
          Relate to <b>{target.title || "Untitled"}</b>
        </div>
        <label className="flex items-center justify-between">
          Show on {target.title || "Untitled"} (two-way)
          <input type="checkbox" checked={twoWay && target.id !== databaseId} disabled={target.id === databaseId} onChange={(e) => setTwoWay(e.target.checked)} className="accent-[var(--ion-deep)]" />
        </label>
        <button
          type="button"
          onClick={() => void create("relation", { name: target.title || "Relation", config: { relation: { databaseId: target.id } }, twoWay: twoWay && target.id !== databaseId })}
          className="h-7 w-full rounded-md bg-ink font-semibold text-paper"
        >
          Add relation
        </button>
      </div>
    );

  return (
    <div className="w-[230px] p-1">
      {TYPE_MENU.map((g, i) => (
        <div key={g.group}>
          {i > 0 ? <MenuSeparator /> : null}
          <MenuLabel>{g.group}</MenuLabel>
          {g.types.map((t) => (
            <MenuButton key={t} icon={<FieldIcon type={t} />} onClick={() => (t === "relation" ? setStep("target") : void create(t))}>
              {typeLabel(t)}
            </MenuButton>
          ))}
        </div>
      ))}
    </div>
  );
}
