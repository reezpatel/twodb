import { useEffect, useMemo, useState } from "react";
import { useTwoDoo, collectLists, type ViewKind } from "./hooks/useTwoDoo";
import { Sidebar } from "./partials/Sidebar";
import { HomePage } from "./partials/HomePage";
import { BoardPage } from "./partials/BoardPage";
import { TaskListView, TrashView } from "./partials/TaskListView";
import { QuickAddBar } from "./partials/QuickAddBar";
import { TaskDetailPanel } from "./partials/TaskDetailPanel";
import { HabitsPage } from "./partials/HabitsPage";
import { CalendarView } from "./partials/CalendarView";
import { KanbanView } from "./partials/KanbanView";

/**
 * TwoDoo scene: sidebar + current view + optional detail panel.
 * View routing is state-based (no router — the desktop shell owns tabs).
 */

const SMART_TITLES: Record<string, { title: string; subtitle: string }> = {
  today: { title: "Today", subtitle: "Due today + overdue" },
  tomorrow: { title: "Tomorrow", subtitle: "Due tomorrow" },
  week: { title: "This Week", subtitle: "Monday → Sunday" },
  month: { title: "This Month", subtitle: "Calendar month" },
  all: { title: "All", subtitle: "Every open task" },
  completed: { title: "Completed", subtitle: "Recently completed" },
};

// Kanban mode per list id (session-local UI preference).
const kanbanLists = new Set<string>();
function useRerender(): () => void {
  const [, force] = useState(0);
  return () => force((n) => n + 1);
}

export function TwoDoo() {
  const app = useTwoDoo();
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const force = useRerender();

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    app.setSearch(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const lists = useMemo(() => collectLists(app.boards), [app.boards]);
  const view = app.view;
  const currentList = view.kind === "list" ? lists.find((l) => l.id === view.listId) : undefined;
  const currentTag = view.kind === "tag" ? app.tags.find((t) => t.id === view.tagId) : undefined;

  const quickAddTarget = view.kind === "list" ? view.listId : lists[0]?.id;

  let body: React.ReactNode;
  if (searchQuery) {
    body = (
      <TaskListView
        title={`Search: ${searchQuery}`}
        subtitle={`${app.tasks.length} results`}
      />
    );
  } else
    switch (app.view.kind) {
      case "home":
        body = <HomePage />;
        break;
      case "board":
        body = <BoardPage boardId={app.view.boardId} />;
        break;
      case "list": {
        body = kanbanLists.has(app.view.listId) ? (
          <KanbanView title={currentList?.name ?? "Board"} />
        ) : (
          <TaskListView title={currentList?.name ?? "List"} subtitle={`${currentList?.openCount ?? 0} open`} />
        );
        break;
      }
      case "smart": {
        const meta = SMART_TITLES[app.view.smart];
        body = <TaskListView title={meta.title} subtitle={meta.subtitle} />;
        break;
      }
      case "tag":
        body = <TaskListView title={`#${currentTag?.name ?? "tag"}`} subtitle="Open tasks with this tag" />;
        break;
      case "calendar":
        body = <CalendarView />;
        break;
      case "habits":
        body = <HabitsPage />;
        break;
    }

  return (
    <div className="flex h-full min-h-0">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-outline px-4 py-2">
          {app.view.kind === "list" && (
            <button
              className="rounded-md border border-outline bg-paper px-2 py-1 text-[11px] text-muted-ink hover:border-ion/40 hover:text-ink"
              onClick={() => {
                if (kanbanLists.has(app.view.kind === "list" ? app.view.listId : "")) kanbanLists.delete(app.view.kind === "list" ? app.view.listId : "");
                else if (app.view.kind === "list") kanbanLists.add(app.view.listId);
                force();
              }}
              title="Toggle board/list layout"
            >
              {kanbanLists.has(app.view.kind === "list" ? app.view.listId : "") ? "List view" : "Board view"}
            </button>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…  (Enter to jump)"
            className="ml-auto w-56 rounded-md border border-outline bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-ion/50"
          />
          <span className="text-[11px] text-muted-ink/60">{app.error ? <span className="text-rose-500">{app.error}</span> : ""}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {app.view.kind !== "calendar" && app.view.kind !== "habits" && !searchQuery && (
            <div className="pt-3">
              <QuickAddBar defaultListId={quickAddTarget ?? null} />
            </div>
          )}
          {body}
        </div>
      </main>
      {app.activeTask && <TaskDetailPanel task={app.activeTask} onClose={() => app.setActiveTaskId(null)} />}
    </div>
  );
}

export type { ViewKind };

