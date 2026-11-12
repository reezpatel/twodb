import { Copy, Trash2 } from "lucide-react";
import { VIEW_TYPES, type ViewType } from "@shared/model";
import { cn } from "@twodb/blocks";
import type { DatabaseViewModel } from "../hooks/useDatabaseView";
import { MenuButton, MenuLabel, MenuSeparator } from "../../ui/MenuButton";
import { VIEW_META } from "./viewIcons";

const sel = "h-7 w-full rounded-md border border-outline bg-paper px-1.5 text-[13px] outline-none focus:border-ion-deep";

export function ViewSettings({ m, onClose }: { m: DatabaseViewModel; onClose: () => void }) {
  const view = m.view;
  if (!view) return null;
  const patch = (b: { name?: string; type?: ViewType }) => void m.garden.patchView(view.databaseId, view.id, b);
  const dateFields = m.fields.filter((f) => f.type === "date" || f.type === "created_time" || f.type === "updated_time");
  return (
    <div className="w-[260px] p-1">
      <div className="p-1">
        <input
          defaultValue={view.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== view.name && patch({ name: e.target.value.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="h-7 w-full rounded-md border border-outline bg-paper px-2 text-[13px] outline-none focus:border-ion-deep"
        />
      </div>
      <MenuLabel>Layout</MenuLabel>
      <div className="grid grid-cols-5 gap-1 px-1">
        {VIEW_TYPES.map((t) => {
          const { Icon, label } = VIEW_META[t];
          return (
            <button
              key={t}
              type="button"
              title={label}
              onClick={() => patch({ type: t })}
              className={cn("flex flex-col items-center gap-0.5 rounded-md border py-1.5 text-[10.5px]", t === view.type ? "border-ink text-ink" : "border-outline text-ink-muted hover:bg-ink/[0.04]")}
            >
              <Icon size={15} /> {label}
            </button>
          );
        })}
      </div>
      {view.type === "calendar" ? (
        <div className="px-1 pt-2">
          <MenuLabel>Show calendar by</MenuLabel>
          <select className={sel} value={view.config.calendar?.dateFieldId ?? ""} onChange={(e) => void m.updateConfig({ calendar: { dateFieldId: e.target.value || null } })}>
            <option value="">Select a date property…</option>
            {dateFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {view.type === "gallery" ? (
        <div className="space-y-1 px-1 pt-2">
          <MenuLabel>Card preview</MenuLabel>
          <select className={sel} value={view.config.gallery?.cover ?? "page"} onChange={(e) => void m.updateConfig({ gallery: { ...view.config.gallery, cover: e.target.value as "page" | "none" } })}>
            <option value="page">Page cover / content</option>
            <option value="none">None</option>
          </select>
          <select className={sel} value={view.config.gallery?.size ?? "medium"} onChange={(e) => void m.updateConfig({ gallery: { ...view.config.gallery, size: e.target.value as "medium" } })}>
            <option value="small">Small cards</option>
            <option value="medium">Medium cards</option>
            <option value="large">Large cards</option>
          </select>
        </div>
      ) : null}
      {view.type === "table" ? (
        <label className="flex items-center justify-between px-2 py-1.5 text-[13px]">
          Wrap cell content
          <input type="checkbox" checked={!!view.config.wrap} onChange={(e) => void m.updateConfig({ wrap: e.target.checked })} className="accent-[var(--ion-deep)]" />
        </label>
      ) : null}
      <MenuSeparator />
      <MenuButton icon={<Copy size={14} />} onClick={() => (onClose(), void m.garden.duplicateView(view.databaseId, view.id).then((v) => m.selectView(v.id)))}>
        Duplicate view
      </MenuButton>
      <MenuButton
        danger
        icon={<Trash2 size={14} />}
        disabled={m.views.length <= 1}
        onClick={() => {
          if (!window.confirm(`Delete view “${view.name}”?`)) return;
          onClose();
          const next = m.views.find((v) => v.id !== view.id);
          void m.garden.deleteView(view.databaseId, view.id).then(() => next && m.selectView(next.id));
        }}
      >
        Delete view
      </MenuButton>
    </div>
  );
}
