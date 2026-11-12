import { useMemo } from "react";
import { cn } from "@twodb/blocks";
import { ChevronRight, ListTodo, Plus } from "lucide-react";
import { useTwoDoo } from "../hooks/useTwoDoo";
import type { Board } from "../../../lib/twoodoo-client";

/**
 * Home — the legacy home page reborn: one card per root board, grouped by
 * space, with nested board/list rollups and due-today highlights.
 */
export function HomePage() {
  const app = useTwoDoo();

  const spaces = useMemo(() => {
    const map = new Map<string, Board[]>();
    for (const b of app.boards) {
      const list = map.get(b.spaceId) ?? [];
      list.push(b);
      map.set(b.spaceId, list);
    }
    return [...map.entries()];
  }, [app.boards]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Home</h1>
        {app.counts && (
          <p className="text-xs text-muted-ink">
            {app.counts.today} due today · {app.counts.all} open · {app.counts.completed} done
          </p>
        )}
      </header>

      {spaces.length === 0 && app.loading && <EmptyState label="Loading…" />}

      {spaces.map(([spaceId, boards]) => (
        <section key={spaceId} className="mb-8">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-ink/70">{spaceId}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
            {boards.length === 0 && <EmptyState label="No boards yet — create one from the sidebar" />}
          </div>
        </section>
      ))}
    </div>
  );
}

function BoardCard(props: { board: Board }) {
  const app = useTwoDoo();
  const { board } = props;
  return (
    <button
      className="group flex flex-col rounded-xl border border-outline bg-paper p-4 text-left shadow-sm transition-shadow hover:shadow-md"
      onClick={() => app.setView({ kind: "board", boardId: board.id })}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-ion/10 text-ion-deep">
            <ListTodo size={14} />
          </span>
          <span className="text-sm font-semibold">{board.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          {board.dueTodayCount > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600">{board.dueTodayCount} today</span>
          )}
          <span className="font-mono text-muted-ink">{board.openCount}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-0.5 text-xs text-muted-ink">
        {board.children.slice(0, 3).map((child) => (
          <div key={child.id} className="flex items-center gap-1.5">
            <ChevronRight size={11} className="opacity-50" />
            <span className="truncate">{child.name}</span>
            <span className="ml-auto font-mono text-[10px]">{child.openCount}</span>
          </div>
        ))}
        {board.lists.slice(0, 4).map((list) => (
          <div key={list.id} className="flex items-center gap-1.5">
            <span className="size-1 rounded-full bg-muted-ink/40" />
            <span className="truncate">{list.name}</span>
            <span className={cn("ml-auto font-mono text-[10px]", list.dueTodayCount > 0 && "font-semibold text-amber-600")}>
              {list.dueTodayCount > 0 ? `${list.dueTodayCount}•` : ""}
              {list.openCount}
            </span>
          </div>
        ))}
        {board.children.length + board.lists.length === 0 && <span className="italic opacity-60">Empty board</span>}
      </div>

      <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-ink/0 transition-colors group-hover:text-muted-ink">
        <Plus size={11} /> open board
      </div>
    </button>
  );
}

function EmptyState(props: { label: string }) {
  return <div className="col-span-full rounded-xl border border-dashed border-outline px-4 py-8 text-center text-xs text-muted-ink/70">{props.label}</div>;
}
