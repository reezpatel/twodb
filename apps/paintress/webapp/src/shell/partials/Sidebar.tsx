import { FileText, Plus, Shapes } from "lucide-react";
import type { Board, BoardGroup } from "@shared/model";
import { useResizableWidth } from "../../lib/useResizableWidth";
import { BoardList } from "./BoardList";
import { useCollapsedGroups } from "../hooks/useCollapsedGroups";
import { useSpaceName } from "../hooks/useSpaceName";
import type { Space } from "../../lib/paintress-client";
import type { SidebarTab } from "../hooks/useShell";

const TABS: Array<{ id: SidebarTab; label: string; title: string; icon: typeof Shapes }> = [
  { id: "diagram", label: "Diagrams", title: "Diagram boards", icon: Shapes },
  { id: "doc", label: "Docs", title: "Markdown boards", icon: FileText },
];

export interface SidebarProps {
  tab: SidebarTab;
  onTabChange(t: SidebarTab): void;
  boards: Board[] | null;
  groups: BoardGroup[];
  spaces: Space[];
  counts: { diagram: number; doc: number };
  activeBoardId: string | null;
  onOpen(b: Board): void;
  onNew(): void;
  onRename(b: Board, name: string): Promise<void> | void;
  onDelete(b: Board): Promise<void> | void;
}

/** Left sidebar, same chrome as Artisan's: title row, icon tab strip, list, footer. */
export function Sidebar(props: SidebarProps) {
  const { width, Handle } = useResizableWidth("paintress.sidebar.left", 256, 180, 480);
  const active = TABS.find((t) => t.id === props.tab)!;
  const { collapsed, toggle } = useCollapsedGroups();
  const spaceName = useSpaceName(props.spaces);

  return (
    <div className="flex h-full min-h-0 shrink-0" style={{ width }}>
      <div className="flex h-full min-h-0 w-full flex-col border-r border-outline/50 bg-card/50 p-3">
        <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-2">
          <span className="min-w-0 flex-1 truncate px-1.5 font-sans text-[13px] font-medium text-ink">{active.title}</span>
          <button
            type="button"
            aria-label={`New ${props.tab === "doc" ? "doc" : "diagram"} board`}
            title={`New ${props.tab === "doc" ? "doc" : "diagram"} board`}
            onClick={props.onNew}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-paper-grid hover:text-ink"
          >
            <Plus className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        <div role="tablist" className="mb-2 flex shrink-0 gap-1 rounded-[8px] bg-paper-grid/60 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={props.tab === t.id}
              aria-label={t.label}
              title={t.title}
              onClick={() => props.onTabChange(t.id)}
              className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[6px] transition-colors ${
                props.tab === t.id ? "bg-stone text-ink" : "text-muted-foreground hover:text-ink"
              }`}
            >
              <t.icon className="size-4" strokeWidth={1.5} />
              <span className="text-[12px]">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <BoardList
            tab={props.tab}
            boards={props.boards}
            groups={props.groups}
            spaceName={spaceName}
            collapsed={collapsed}
            onToggleSection={toggle}
            activeBoardId={props.activeBoardId}
            onOpen={props.onOpen}
            onRename={props.onRename}
            onDelete={props.onDelete}
            onNew={props.onNew}
          />
        </div>
        <div className="mt-auto flex shrink-0 items-center justify-between border-t border-outline/50 px-2.5 pt-3 text-[11px] text-muted-foreground/60">
          <span>Paintress</span>
          <span>
            {props.counts.diagram} diagram{props.counts.diagram === 1 ? "" : "s"} · {props.counts.doc} doc{props.counts.doc === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <Handle edge="right" />
    </div>
  );
}
