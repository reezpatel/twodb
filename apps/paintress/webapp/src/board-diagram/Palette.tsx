import { useRef } from "react";
import { Image as ImageIcon, StickyNote, Table2, Type, Rows3 } from "lucide-react";
import { usePalette, type PaletteTab } from "./hooks/usePalette";
import { GroupList } from "./partials/GroupList";
import { IconGrid } from "./partials/IconGrid";
import { PaletteItem } from "./partials/PaletteItem";
import { ShapeGrid } from "./partials/ShapeGrid";

export interface PaletteActions {
  addShape(pack: string, shape: string): void;
  addGroup(style: string): void;
  addIcon(icon: string, label: string): void;
  addEntity(): void;
  addPool(): void;
  addSticky(): void;
  addText(): void;
  addImage(file: File): void;
}

const TABS: [PaletteTab, string][] = [
  ["shapes", "Shapes"],
  ["groups", "Cloud"],
  ["icons", "Icons"],
  ["more", "More"],
];

/** Left palette: shapes, cloud containers, icon search, and tables/swimlanes/notes. Click or drag onto the canvas. */
export function Palette({ actions, disabled }: { actions: PaletteActions; disabled: boolean }) {
  const p = usePalette();
  const file = useRef<HTMLInputElement>(null);
  return (
    <aside className={`absolute bottom-3 left-3 top-3 z-10 flex w-64 flex-col overflow-hidden rounded-md border border-outline bg-popover shadow-lg ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      <div className="flex border-b border-outline">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => p.setTab(id)} className={`flex-1 py-2 text-[12px] font-semibold ${p.tab === id ? "border-b-2 border-ink text-ink" : "text-ink-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {p.tab === "shapes" && <ShapeGrid pack={p.pack} onPack={p.setPack} onAdd={actions.addShape} />}
        {p.tab === "groups" && <GroupList onAdd={actions.addGroup} />}
        {p.tab === "icons" && (
          <IconGrid query={p.query} onQuery={p.setQuery} set={p.set} onSet={p.setSet} icons={p.icons} searching={p.searching} onAdd={(i) => actions.addIcon(i.id, i.name.replace(/^aws-/, "").replace(/-icon$/, "").replace(/[-_]/g, " "))} />
        )}
        {p.tab === "more" && (
          <div className="grid grid-cols-3 gap-1">
            <PaletteItem title="Table (ERD entity)" label="Table" payload={{ kind: "entity" }} onClick={actions.addEntity}>
              <Table2 className="size-6 text-ink-muted" />
            </PaletteItem>
            <PaletteItem title="Swimlanes (pool with lanes)" label="Swimlanes" payload={{ kind: "pool" }} onClick={actions.addPool}>
              <Rows3 className="size-6 text-ink-muted" />
            </PaletteItem>
            <PaletteItem title="Sticky note" label="Note" payload={{ kind: "sticky" }} onClick={actions.addSticky}>
              <StickyNote className="size-6 text-amber-500" />
            </PaletteItem>
            <PaletteItem title="Text" label="Text" payload={{ kind: "text" }} onClick={actions.addText}>
              <Type className="size-6 text-ink-muted" />
            </PaletteItem>
            <button type="button" onClick={() => file.current?.click()} className="flex flex-col items-center gap-1 rounded-sm border border-transparent p-1.5 hover:border-outline hover:bg-paper-grid">
              <div className="flex h-10 items-center">
                <ImageIcon className="size-6 text-ink-muted" />
              </div>
              <span className="text-[10px] text-ink-muted">Image</span>
            </button>
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) actions.addImage(f);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
