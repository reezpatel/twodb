import { useMemo } from "react";
import { cn } from "@twodb/blocks";
import { ChevronRight, Plus, ListTodo } from "lucide-react";
import { useTwoDoo } from "../hooks/useTwoDoo";
import { TaskRow } from "./TaskRow";
import type { Board } from "../../../lib/twoodoo-client";

/**
 * Board drill-in: child boards + lists as columns/sections, tasks of the
 * whole board subtree, grouped by list. This is the "refresh space board"
 * rollup — everything nested under the board in one page.
 */
export function BoardPage(props: { boardId: string }) {
  const app = useTwoDoo();
  const board = useMemo(() => {
    const find = (bs: Board[], id: string): Board | null => {
      for (const b of bs) {
        if (b.id === id) return b;
        const hit = find(b.children, id);
        if (hit) return hit;
      }
      return null;
    };
    return find(app.boards, props.boardId);
  }, [app.boards, props.boardId]);

  if (!board) return <div className="p-8 text-sm text-muted-ink">Board not found (it may have been deleted).</div>;

  const byList = new Map<string, typeof app.tasks>();
  for (const t of app.tasks) {
    const list = byList.get(t.listId) ?? [];
    list.push(t);
    byList.set(t.listId, list);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-5">
      <Breadcrumbs board={board} />
      <header className="mb-4 mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-ion/10 text-ion-deep">
            <ListTodo size={16} />
          </span>
          <div>
            <h1 className="text-base font-semibold">{board.name}</h1>
            <p className="text-xs text-muted-ink">
              {board.openCount} open · {board.dueTodayCount} due today
            </p>
          </div>
        </div>
      </header>

      {(board.children.length > 0 || board.lists.length === 0) && (
        <section className="mb-5">
          <SectionLabel>Boards</SectionLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {board.children.map((child) => (
              <button
                key={child.id}
                className="flex items-center justify-between rounded-lg border border-outline bg-paper px-3 py-2.5 text-left hover:border-ion/40"
                onClick={() => app.setView({ kind: "board", boardId: child.id })}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-sm">
                  <ListTodo size={13} className="shrink-0 text-muted-ink" />
                  <span className="truncate">{child.name}</span>
                </span>
                <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-ink">{child.openCount}</span>
              </button>
            ))}
            <button
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-outline px-3 py-2.5 text-xs text-muted-ink/80 hover:border-ion/40 hover:text-ink"
              onClick={() => {
                const name = window.prompt("Sub-board name");
                if (name?.trim()) void app.createBoard(name.trim(), board.spaceId, board.id);
              }}
            >
              <Plus size={12} /> New board
            </button>
          </div>
        </section>
      )}

      {board.lists.map((list) => (
        <section key={list.id} className="mb-5">
          <div className="mb-1 flex items-center justify-between px-1">
            <SectionLabel>
              {list.name} · {list.openCount}
            </SectionLabel>
            <button className="text-[11px] text-muted-ink/70 hover:text-ink" onClick={() => app.setView({ kind: "list", listId: list.id })}>
              open list →
            </button>
          </div>
          <div className={cn("flex flex-col rounded-xl border border-outline bg-paper p-1", (byList.get(list.id) ?? []).length === 0 && "py-3")}>
            {(byList.get(list.id) ?? [])
              .filter((t) => t.status === "open")
              .map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  active={app.activeTaskId === task.id}
                  onOpen={() => app.setActiveTaskId(app.activeTaskId === task.id ? null : task.id)}
                  onToggle={() => void app.toggleTask(task)}
                />
              ))}
            {(byList.get(list.id) ?? []).filter((t) => t.status === "open").length === 0 && (
              <div className="px-3 text-center text-xs text-muted-ink/60">No open tasks</div>
            )}
          </div>
        </section>
      ))}

      {board.lists.length === 0 && board.children.length > 0 && (
        <button
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-outline px-3 py-2 text-xs text-muted-ink/80 hover:border-ion/40 hover:text-ink"
          onClick={() => {
            const name = window.prompt("List name");
            if (name?.trim()) void app.createList(board.id, name.trim());
          }}
        >
          <Plus size={12} /> New list in this board
        </button>
      )}
    </div>
  );
}

function Breadcrumbs(props: { board: Board }) {
  const app = useTwoDoo();
  return (
    <div className="flex items-center gap-1 text-xs text-muted-ink">
      <button className="hover:text-ink" onClick={() => app.setView({ kind: "home" })}>
        Home
      </button>
      <ChevronRight size={11} className="opacity-50" />
      <span className="text-ink/80">{props.board.name}</span>
    </div>
  );
}

function SectionLabel(props: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-ink/60">{props.children}</div>;
}
