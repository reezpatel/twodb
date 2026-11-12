import { cn } from "@twodb/blocks";
import { CheckCircle2, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { useTwoDoo } from "../hooks/useTwoDoo";
import { TaskRow } from "./TaskRow";

/**
 * Task list (list view / smart view / board view / tag view all render
 * through this): quick-add targeted at the list, grouped rows, completed
 * collapsed at the bottom.
 */
export function TaskListView(props: { title: string; subtitle?: string; quickAddListId?: string | null }) {
  const app = useTwoDoo();
  const open = app.tasks.filter((t) => t.status === "open" && !t.parentId);
  const done = app.tasks.filter((t) => t.status === "done" && !t.parentId);
  const isTrash = app.view.kind === "smart" && app.view.smart === "all" && false;
  void isTrash;

  return (
    <div className="mx-auto max-w-3xl px-6 py-5">
      <header className="mb-3 flex items-baseline justify-between px-1">
        <div>
          <h1 className="text-base font-semibold">{props.title}</h1>
          {props.subtitle && <p className="mt-0.5 text-xs text-muted-ink">{props.subtitle}</p>}
        </div>
        <span className="font-mono text-xs text-muted-ink">{open.length}</span>
      </header>

      {app.tasks.length === 0 && app.loading && <div className="px-2 py-8 text-center text-xs text-muted-ink/70">Loading…</div>}
      {app.tasks.length === 0 && !app.loading && (
        <div className="rounded-xl border border-dashed border-outline px-4 py-10 text-center text-xs text-muted-ink/70">
          Nothing here yet
        </div>
      )}

      <div className="flex flex-col">
        {open.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            active={app.activeTaskId === task.id}
            onOpen={() => app.setActiveTaskId(app.activeTaskId === task.id ? null : task.id)}
            onToggle={() => void app.toggleTask(task)}
          />
        ))}
      </div>

      {done.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-ink/60">
            <CheckCircle2 size={11} />
            Completed · {done.length}
          </div>
          <div className="flex flex-col opacity-80">
            {done.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                active={app.activeTaskId === task.id}
                onOpen={() => app.setActiveTaskId(app.activeTaskId === task.id ? null : task.id)}
                onToggle={() => void app.toggleTask(task)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Trash view (smart=all&status=trashed is a dedicated rendering). */
export function TrashView() {
  const app = useTwoDoo();
  return (
    <div className="mx-auto max-w-3xl px-6 py-5">
      <header className="mb-3 px-1">
        <h1 className="text-base font-semibold">Trash</h1>
        <p className="mt-0.5 text-xs text-muted-ink">{app.tasks.length} trashed tasks</p>
      </header>
      {app.tasks.length === 0 && (
        <div className="rounded-xl border border-dashed border-outline px-4 py-10 text-center text-xs text-muted-ink/70">Trash is empty</div>
      )}
      <div className="flex flex-col">
        {app.tasks.map((task) => (
          <div key={task.id} className="group flex items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-ink/[0.04]">
            <Trash2 size={13} className="shrink-0 text-muted-ink/50" />
            <span className="min-w-0 flex-1 truncate text-sm text-muted-ink">{task.title}</span>
            <button className="rounded-md p-1 text-[11px] text-muted-ink opacity-0 group-hover:opacity-100 hover:bg-ink/5 hover:text-ink" onClick={() => void app.restoreTask(task.id)} title="Restore">
              <RotateCcw size={12} />
            </button>
            <button className={cn("rounded-md p-1 text-[11px] text-rose-400 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10")} onClick={() => void app.deleteTaskForever(task.id)} title="Delete forever">
              <MoreHorizontal size={12} className="rotate-45" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
