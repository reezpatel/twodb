import { ChevronsUpDown, Database, FileText, LayoutList, PanelLeftClose, Plus, Search, Sprout, Trash2, Check } from "lucide-react";
import { useSidebar } from "./hooks/useSidebar";
import { TreeItem } from "./partials/TreeItem";
import { SidebarLink, SidebarSection } from "./partials/SidebarLink";
import { Popover } from "../ui/Popover";
import { IconButton } from "../ui/IconButton";
import { MenuButton, MenuLabel } from "../ui/MenuButton";

/** AFFiNE-style left sidebar. */
export function Sidebar({ onSearch, onCollapse }: { onSearch: () => void; onCollapse: () => void }) {
  const s = useSidebar();
  const mod = navigator.platform.includes("Mac") ? "⌘" : "Ctrl+";
  return (
    <aside className="flex h-full w-full flex-col bg-stone/70">
      <div className="flex items-center gap-1 px-2 pb-1 pt-2.5">
        <Popover
          trigger={
            <button type="button" className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 hover:bg-ink/[0.05]">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-tritium/70 text-ink">
                <Sprout size={15} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13.5px] font-semibold leading-tight">Garden</span>
                <span className="block truncate text-[11.5px] leading-tight text-ink-muted">{s.currentSpace?.name ?? "Personal"}</span>
              </span>
              <ChevronsUpDown size={14} className="shrink-0 text-ink-muted" />
            </button>
          }
        >
          <div className="w-[220px] p-1">
            <MenuLabel>Spaces</MenuLabel>
            {s.spaces.map((sp) => (
              <MenuButton key={sp.id} onClick={() => s.switchSpace(sp.id)} trailing={sp.id === s.currentSpace?.id ? <Check size={14} /> : null}>
                {sp.name}
              </MenuButton>
            ))}
            {!s.spaces.length ? <div className="px-2 py-1 text-[12.5px] text-ink-muted">No spaces — using the default</div> : null}
          </div>
        </Popover>
        <IconButton title="Collapse sidebar" onClick={onCollapse}>
          <PanelLeftClose size={16} />
        </IconButton>
      </div>

      <div className="px-2">
        <button type="button" onClick={onSearch} className="mb-1 flex h-[30px] w-full items-center gap-2 rounded-md border border-outline bg-paper/70 px-2 text-[13px] text-ink-muted hover:bg-paper">
          <Search size={14} /> <span className="flex-1 text-left">Search</span>
          <kbd className="font-sans text-[11px]">{mod}K</kbd>
        </button>
        <SidebarLink to="/all" icon={<LayoutList size={15} />}>
          All docs
        </SidebarLink>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" {...s.rootDrop}>
        {s.favorites.length ? (
          <SidebarSection title="Favorites">
            {s.favorites.map((n) => (
              <TreeItem key={`fav-${n.id}`} node={n} depth={0} ctx={s.ctx} showChildren={false} />
            ))}
          </SidebarSection>
        ) : null}
        <SidebarSection
          title="Pages"
          action={
            <Popover
              trigger={
                <IconButton size="sm" title="New">
                  <Plus size={14} />
                </IconButton>
              }
            >
              <div className="w-[190px] p-1">
                <MenuButton icon={<FileText size={14} />} onClick={() => void s.newDoc()}>
                  New page
                </MenuButton>
                <MenuButton icon={<Database size={14} />} onClick={() => void s.newDatabase()}>
                  New database
                </MenuButton>
              </div>
            </Popover>
          }
        >
          {s.roots.map((n) => (
            <TreeItem key={n.id} node={n} depth={0} ctx={s.ctx} />
          ))}
          {!s.loading && !s.roots.length ? <div className="px-2 py-1 text-[12.5px] text-ink-muted">No pages yet</div> : null}
          {s.error ? <div className="px-2 py-1 text-[12.5px] text-destructive">Could not load pages</div> : null}
        </SidebarSection>
        <div className="mt-4">
          <SidebarLink to="/trash" icon={<Trash2 size={15} />}>
            Trash
          </SidebarLink>
        </div>
      </div>

      <div className="border-t border-outline p-2">
        <button type="button" onClick={() => void s.newDoc()} className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-ink text-[13px] font-semibold text-paper hover:opacity-90">
          <Plus size={15} strokeWidth={2.5} /> New doc
        </button>
      </div>
    </aside>
  );
}
