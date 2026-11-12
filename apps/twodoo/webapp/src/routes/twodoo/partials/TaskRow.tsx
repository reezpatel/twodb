import { cn } from "@twodb/blocks";
import { CalendarClock, Check, Repeat, Tag as TagIcon } from "lucide-react";
import type { Task } from "../../../lib/twoodoo-client";
import { describeRecurrence, formatDue } from "../../../lib/quick-add";
import { isOverdue } from "../../../lib/dates";
import { PriorityFlag } from "./PriorityFlag";

/** One task row — checkbox, priority flag, title, due, tags, recurrence. */
export function TaskRow(props: { task: Task; active: boolean; onOpen: () => void; onToggle: () => void; compact?: boolean }) {
  const { task, active, onOpen, onToggle } = props;
  const done = task.status === "done";
  const due = formatDue(task.startAt, task.endAt, task.allDay);
  const overdue = isOverdue(task.startAt, task.status);

  return (
    <div
      className={cn(
        "group flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 hover:bg-ink/[0.04]",
        active && "bg-ion/10",
      )}
      onClick={onOpen}
    >
      <button
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
          done ? "border-ion bg-ion text-paper" : "border-muted-ink/40 text-transparent hover:border-ion",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        title={done ? "Mark incomplete" : "Complete"}
      >
        <Check size={10} strokeWidth={3.5} />
      </button>

      <PriorityFlag priority={task.priority} />

      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-sm", done && "text-muted-ink line-through")}>{task.title}</div>
        {!props.compact && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-ink">
            {due && (
              <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-rose-500")}>
                <CalendarClock size={11} className={overdue ? "" : "opacity-70"} />
                {due}
              </span>
            )}
            {task.recurrenceRule && (
              <span className="inline-flex items-center gap-1" title={describeRecurrence(task.recurrenceRule) ?? ""}>
                <Repeat size={11} className="opacity-70" />
                {describeRecurrence(task.recurrenceRule)}
              </span>
            )}
            {task.checklistTotal > 0 && (
              <span className={cn("font-mono", task.checklistDone === task.checklistTotal && "text-emerald-500")}>
                ✓ {task.checklistDone}/{task.checklistTotal}
              </span>
            )}
            {task.tags.map((tag) => (
              <span key={tag.id} className="inline-flex items-center gap-0.5 rounded-full bg-ink/5 px-1.5 py-px">
                <TagIcon size={9} className="opacity-60" />
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
