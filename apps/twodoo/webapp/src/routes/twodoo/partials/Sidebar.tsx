import { useState } from "react";
import { CalendarRange, ChevronRight, Flame, Hash, House, Inbox, Layers, ListTodo, MoreHorizontal, Pencil, Plus, Sun, Sunrise, Trash2 } from "lucide-react";
import { cn } from "@twodb/blocks";
import { useTwoDoo, type ViewKind } from "../hooks/useTwoDoo";
import type { Board } from "../../../lib/twoodoo-client";

/**
 * Left sidebar: smart lists, then the space → board → list tree.
 * Dumb component — all logic lives in useTwoDoo + local tree-collapsed state.
 */

const SMART_ITEMS: { key: "today" | "tomorrow" | "week" | "month" | "all" | "completed"; label: string; icon: typeof Sun }[] = [
  { key: "today", label: "Today", icon: Sun },
  { key: "tomorrow", label: "Tomorrow", icon: Sunrise },
  { key: "week", label: "This Week", icon: CalendarRange },
  { key: "month", label: "This Month", icon: Layers },
  { key: "all", label: "All", icon: Inbox },
  { key: "completed", label: "Completed", icon: ListTodo },
];

export function Sidebar() {
  const app = useTwoDoo();
  const [collapsedBoards, setCollapsedBoards] = useState<Set<string>>(new Set());

  const isSmartActive = (key: string) => app.view.kind === "smart" && app.view.smart === key;

  const toggleCollapse = (id: string) =>
    setCollapsedBoards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-outline bg-paper/60">
      <div className="flex items-center gap-2 px-3 py-3">
        <span className="grid size-6 place-items-center rounded-md bg-ion text-paper">
          <ListTodo size={14} />
        </span>
        <span className="text-sm font-semibold">TwoDoo</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <button
          className={rowCls(app.view.kind === "home")}
          onClick={() => app.setView({ kind: "home" })}
        >
          <House size={14} className="shrink-0 text-muted-ink" />
          <span className="truncate">Home</span>
        </button>

        <SectionLabel>Smart Lists</SectionLabel>
        {SMART_ITEMS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={rowCls(isSmartActive(key))} onClick={() => app.setView({ kind: "smart", smart: key })}>
            <Icon size={14} className={cn("shrink-0", key === "today" ? "text-amber-500" : "text-muted-ink")} />
            <span className="truncate">{label}</span>
            {app.counts && <span className="ml-auto font-mono text-[10px] text-muted-ink">{app.counts[key]}</span>}
          </button>
        ))}

        <SectionLabel>Views</SectionLabel>
        <button className={rowCls(app.view.kind === "calendar")} onClick={() => app.setView({ kind: "calendar" })}>
          <CalendarRange size={14} className="shrink-0 text-muted-ink" />
          <span className="truncate">Calendar</span>
        </button>
        <button className={rowCls(app.view.kind === "habits")} onClick={() => app.setView({ kind: "habits" })}>
          <Flame size={14} className="shrink-0 text-rose-400" />
          <span className="truncate">Habits</span>
        </button>

        {app.tags.length > 0 && (
          <>
            <SectionLabel>Tags</SectionLabel>
            {app.tags.slice(0, 12).map((tag) => (
              <button
                key={tag.id}
                className={rowCls(app.view.kind === "tag" && app.view.tagId === tag.id)}
                onClick={() => app.setView({ kind: "tag", tagId: tag.id })}
              >
                <Hash size={13} className="shrink-0 text-muted-ink" />
                <span className="truncate">{tag.name}</span>
              </button>
            ))}
          </>
        )}

        <SectionLabel>Spaces</SectionLabel>
        {groupRootsBySpace(app.boards).map(({ spaceId, boards }) => (
          <div key={spaceId} className="mb-1">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-ink/70">{spaceId}</div>
            {boards.map((board) => (
              <BoardNode
                key={board.id}
                board={board}
                depth={0}
                collapsed={collapsedBoards}
                onToggle={toggleCollapse}
              />
            ))}
            <AddBoardRow spaceId={spaceId} />
          </div>
        ))}
      </nav>
    </aside>
  );
}

function groupRootsBySpace(boards: Board[]): { spaceId: string; boards: Board[] }[] {
  const map = new Map<string, Board[]>();
  for (const b of boards) {
    const list = map.get(b.spaceId) ?? [];
    list.push(b);
    map.set(b.spaceId, list);
  }
  return [...map.entries()].map(([spaceId, bs]) => ({ spaceId, boards: bs }));
}

function rowCls(active: boolean): string {
  return cn(
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink/90 hover:bg-ink/5",
    active && "bg-ion/10 font-medium text-ion-deep",
  );
}

function SectionLabel(props: { children: React.ReactNode }) {
  return <div className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-ink/60">{props.children}</div>;
}

function BoardNode(props: { board: Board; depth: number; collapsed: Set<string>; onToggle: (id: string) => void }) {
  const app = useTwoDoo();
  const { board, depth, collapsed, onToggle } = props;
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(board.name);
  const [addingList, setAddingList] = useState(false);
  const [newList, setNewList] = useState("");
  const isOpen = !collapsed.has(board.id);
  const hasChildren = board.children.length > 0 || board.lists.length > 0;
  const active = app.view.kind === "board" && app.view.boardId === board.id;

  return (
    <div>
      <div className={cn("group relative flex items-center", rowCls(active))} style={{ paddingLeft: depth * 12 + 4 }}>
        <button
          className="shrink-0 text-muted-ink/60 hover:text-ink"
          onClick={() => onToggle(board.id)}
          title={isOpen ? "Collapse" : "Expand"}
        >
          <ChevronRight size={13} className={cn("transition-transform", isOpen && hasChildren && "rotate-90")} />
        </button>
        <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => app.setView({ kind: "board", boardId: board.id })}>
          <span className="truncate">{board.name}</span>
          {board.openCount > 0 && <span className="ml-auto font-mono text-[10px] text-muted-ink">{board.openCount}</span>}
        </button>
        <button className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-ink/60 hover:text-ink" onClick={() => setMenu((m) => !m)} title="More">
          <MoreHorizontal size={13} />
        </button>
        {menu && (
          <div className="absolute right-2 top-8 z-20 w-40 rounded-md border border-outline bg-paper p-1 text-xs shadow-lg">
            <MenuItem icon={<Pencil size={12} />} onClick={() => { setRenaming(true); setMenu(false); }}>Rename</MenuItem>
            <MenuItem icon={<Plus size={12} />} onClick={() => { setAddingList(true); setMenu(false); }}>Add list</MenuItem>
            <MenuItem
              icon={<Plus size={12} />}
              onClick={() => { void app.createBoard("New board", board.spaceId, board.id); setMenu(false); }}
            >
              Add sub-board
            </MenuItem>
            <MenuItem icon={<Trash2 size={12} />} danger onClick={() => { void app.deleteBoard(board.id); setMenu(false); }}>Delete board</MenuItem>
          </div>
        )}
      </div>

      {renaming && (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setRenaming(false); if (draft.trim() && draft !== board.name) void app.renameBoard(board.id, draft.trim()); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(board.name); setRenaming(false); } }}
          className="mx-2 mb-1 w-[calc(100%-1rem)] rounded-sm border border-ion/40 bg-paper px-1.5 py-0.5 text-xs outline-none"
          style={{ marginLeft: depth * 12 + 20 }}
        />
      )}

      {isOpen && (
        <div>
          {board.lists.map((list) => (
            <ListRow key={list.id} listId={list.id} name={list.name} openCount={list.openCount} depth={depth + 1} />
          ))}
          {board.children.map((child) => (
            <BoardNode key={child.id} board={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
          ))}
          {addingList && (
            <input
              autoFocus
              value={newList}
              placeholder="List name…"
              onChange={(e) => setNewList(e.target.value)}
              onBlur={() => { setAddingList(false); setNewList(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newList.trim()) { void app.createList(board.id, newList.trim()); setNewList(""); setAddingList(false); }
                if (e.key === "Escape") { setAddingList(false); setNewList(""); }
              }}
              className="mx-2 mb-1 w-[calc(100%-1rem)] rounded-sm border border-ion/40 bg-paper px-1.5 py-0.5 text-xs outline-none"
              style={{ marginLeft: (depth + 1) * 12 + 20 }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ListRow(props: { listId: string; name: string; openCount: number; depth: number }) {
  const app = useTwoDoo();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(props.name);
  const active = app.view.kind === "list" && app.view.listId === props.listId;
  return (
    <div className={cn("group relative flex items-center", rowCls(active))} style={{ paddingLeft: props.depth * 12 + 20 }}>
      <button
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        onClick={() => app.setView({ kind: "list", listId: props.listId } as ViewKind)}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-muted-ink/40" />
        <span className="truncate text-[13px]">{props.name}</span>
        {props.openCount > 0 && <span className="ml-auto font-mono text-[10px] text-muted-ink">{props.openCount}</span>}
      </button>
      <button className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-ink/60 hover:text-ink" onClick={() => setMenu((m) => !m)} title="More">
        <MoreHorizontal size={13} />
      </button>
      {menu && (
        <div className="absolute right-2 top-8 z-20 w-36 rounded-md border border-outline bg-paper p-1 text-xs shadow-lg">
          <MenuItem icon={<Pencil size={12} />} onClick={() => { setRenaming(true); setMenu(false); }}>Rename</MenuItem>
          <MenuItem icon={<Trash2 size={12} />} danger onClick={() => { void app.deleteList(props.listId); setMenu(false); }}>Delete list</MenuItem>
        </div>
      )}
      {renaming && (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { setRenaming(false); if (draft.trim() && draft !== props.name) void app.renameList(props.listId, draft.trim()); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(props.name); setRenaming(false); } }}
          className="absolute left-6 top-0 z-10 w-[calc(100%-3rem)] rounded-sm border border-ion/40 bg-paper px-1.5 py-0.5 text-xs outline-none"
        />
      )}
    </div>
  );
}

function AddBoardRow(props: { spaceId: string }) {
  const app = useTwoDoo();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (!open)
    return (
      <button className="mx-2 mt-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-ink/70 hover:bg-ink/5" onClick={() => setOpen(true)}>
        <Plus size={12} /> New board
      </button>
    );
  return (
    <input
      autoFocus
      value={name}
      placeholder="Board name…"
      onChange={(e) => setName(e.target.value)}
      onBlur={() => { setOpen(false); setName(""); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && name.trim()) { void app.createBoard(name.trim(), props.spaceId, null); setName(""); setOpen(false); }
        if (e.key === "Escape") { setOpen(false); setName(""); }
      }}
      className="mx-2 mt-1 w-[calc(100%-1rem)] rounded-sm border border-ion/40 bg-paper px-1.5 py-0.5 text-xs outline-none"
    />
  );
}

function MenuItem(props: { icon: React.ReactNode; children: React.ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <button
      className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-ink/5", props.danger && "text-rose-500 hover:bg-rose-500/10")}
      onClick={props.onClick}
    >
      {props.icon}
      {props.children}
    </button>
  );
}
