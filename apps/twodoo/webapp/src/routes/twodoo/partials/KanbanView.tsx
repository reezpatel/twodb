import { useState } from "react";
import { cn } from "@twodb/blocks";
import { Check, Columns3, List } from "lucide-react";
import { useTwoDoo } from "../hooks/useTwoDoo";
import type { Task } from "../../../lib/twoodoo-client";

/**
 * Kanban board for a list (or any task set): columns = Todo / In Progress /
 * Done approximation driven by completion + presence of an active time
 * window. Drag between columns updates the task (complete / open).
 */
const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "doing", label: "In Progress" },
  { key: "done", label: "Done" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

function columnOf(task: Task): ColumnKey {
  if (task.status === "done") return "done";
  const now = Date.now();
  if (task.startAt && task.endAt && new Date(task.endAt).getTime() > now && new Date(task.startAt).getTime() <= now) return "doing";
  if (task.checklistTotal > 0 && task.checklistDone > 0) return "doing";
  return "todo";
}

export function KanbanView(props: { title: string }) {
  const app = useTwoDoo();
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<ColumnKey | null>(null);

  const drop = async (column: ColumnKey) => {
    if (!dragTaskId) return;
    const task = app.tasks.find((t) => t.id === dragTaskId);
    setDragTaskId(null);
    setDragOver(null);
    if (!task || columnOf(task) === column) return;
    if (column === "done") await app.toggleTask(task);
    else if (task.status === "done") await app.toggleTask(task);
    // todo ↔ doing is presentation-only for now (time-window derived)
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col px-6 py-5">
      <header className="mb-4 flex items-center justify-between px-1">
        <h1 className="text-base font-semibold">{props.title}</h1>
        <div className="flex items-center gap-1 rounded-lg border border-outline bg-paper p-0.5 text-xs">
          <button className="flex items-center gap-1 rounded-md px-2 py-1 text-muted-ink hover:bg-ink/5" onClick={() => app.setView({ kind: "list", listId: (app.view as { listId: string }).listId })}>
            <List size={12} /> List
          </button>
          <span className="flex items-center gap-1 rounded-md bg-ion/10 px-2 py-1 font-medium text-ion-deep">
            <Columns3 size={12} /> Board
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
        {COLUMNS.map((col) => {
          const tasks = app.tasks.filter((t) => t.status !== "trashed" && columnOf(t) === col.key);
          return (
            <div
              key={col.key}
              className={cn(
                "flex min-h-0 flex-col rounded-xl border border-outline bg-paper/60",
                dragOver === col.key && "border-ion/60 bg-ion/5",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => void drop(col.key)}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-ink/70">{col.label}</span>
                <span className="font-mono text-[11px] text-muted-ink">{tasks.length}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDragTaskId(task.id)}
                    onDragEnd={() => {
                      setDragTaskId(null);
                      setDragOver(null);
                    }}
                    className={cn(
                      "cursor-grab rounded-lg border border-outline bg-paper p-2.5 shadow-sm transition-opacity hover:border-ion/40",
                      dragTaskId === task.id && "opacity-40",
                    )}
                    onClick={() => app.setActiveTaskId(task.id)}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-0.5 size-2 shrink-0 rounded-full",
                          task.priority === "urgent" ? "bg-rose-500" : task.priority === "high" ? "bg-amber-500" : "bg-muted-ink/30",
                        )}
                      />
                      <span className={cn("min-w-0 flex-1 text-[13px] leading-snug", task.status === "done" && "text-muted-ink line-through")}>
                        {task.title}
                      </span>
                      {task.status === "done" && <Check size={12} className="shrink-0 text-emerald-500" />}
                    </div>
                    {task.checklistTotal > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-ink">
                        <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                          <div className="h-full bg-emerald-500" style={{ width: `${(task.checklistDone / task.checklistTotal) * 100}%` }} />
                        </div>
                        {task.checklistDone}/{task.checklistTotal}
                      </div>
                    )}
                  </div>
                ))}
                {tasks.length === 0 && <div className="grid flex-1 place-items-center text-[11px] text-muted-ink/50">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
