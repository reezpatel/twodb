import { useEffect, useRef, useState } from "react";
import { cn } from "@twodb/blocks";
import { RichTextEditor } from "@twodb/editor";
import { Check, ChevronDown, Flag, Hash, Plus, Repeat, Trash2, X } from "lucide-react";
import { useTwoDoo } from "../hooks/useTwoDoo";
import { describeRecurrence } from "../../../lib/quick-add";
import { PriorityFlag } from "./PriorityFlag";
import type { Priority, Task } from "../../../lib/twoodoo-client";

/**
 * Right-hand detail panel for the selected task: title, TipTap description,
 * checklist subtasks, dates, priority, tags. Auto-saves with debounce.
 */
export function TaskDetailPanel(props: { task: Task; onClose: () => void }) {
  const app = useTwoDoo();
  const { task } = props;
  const [title, setTitle] = useState(task.title);
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(task.title);
  }, [task.id, task.title]);

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (saveTimer) clearTimeout(saveTimer);
    setSaveTimer(
      setTimeout(() => {
        if (value.trim() && value !== task.title) void app.updateTask(task.id, { title: value.trim() });
      }, 500),
    );
  };

  const [newItem, setNewItem] = useState("");

  return (
    <div className="flex h-full w-[26rem] shrink-0 flex-col border-l border-outline bg-paper">
      <div className="flex items-center justify-between px-4 pt-3">
        <PriorityFlag priority={task.priority} />
        <button className="rounded-md p-1 text-muted-ink hover:bg-ink/5 hover:text-ink" onClick={props.onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex items-start gap-2.5">
          <button
            className={cn(
              "mt-1 grid size-4.5 shrink-0 place-items-center rounded-full border transition-colors",
              task.status === "done" ? "border-ion bg-ion text-paper" : "border-muted-ink/40 text-transparent hover:border-ion",
            )}
            onClick={() => void app.toggleTask(task)}
          >
            <Check size={11} strokeWidth={3.5} />
          </button>
          <textarea
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            rows={2}
            className="min-h-0 flex-1 resize-none bg-transparent text-[15px] font-semibold leading-snug outline-none"
          />
        </div>

        <MetaRows task={task} />

        {/* Description — TipTap */}
        <div className="mt-3">
          <RichTextEditor bare value={task.descriptionHtml ?? ""} placeholder="Add notes…" onBlur={(html) => {
            if (html !== (task.descriptionHtml ?? "")) void app.updateTask(task.id, { descriptionHtml: html });
          }} />
        </div>

        {/* Checklist */}
        <div className="mt-4">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-ink/60">
            Checklist
            {task.checklistTotal > 0 && (
              <span className={cn("font-mono", task.checklistDone === task.checklistTotal && "text-emerald-500")}>
                {task.checklistDone}/{task.checklistTotal}
              </span>
            )}
          </div>
          <div className="flex flex-col">
            {task.checklist.map((item) => (
              <div key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-ink/[0.04]">
                <button
                  className={cn(
                    "grid size-3.5 shrink-0 place-items-center rounded-[3px] border transition-colors",
                    item.checked ? "border-ion bg-ion text-paper" : "border-muted-ink/40 text-transparent hover:border-ion",
                  )}
                  onClick={() => void app.toggleChecklistItem(task.id, item.id, !item.checked)}
                >
                  <Check size={8} strokeWidth={3.5} />
                </button>
                <span className={cn("min-w-0 flex-1 text-[13px]", item.checked && "text-muted-ink line-through")}>{item.content}</span>
                <button
                  className="shrink-0 text-muted-ink/50 opacity-0 group-hover:opacity-100 hover:text-rose-500"
                  onClick={() => void app.deleteChecklistItem(task.id, item.id)}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 px-1 py-1">
              <Plus size={12} className="shrink-0 text-muted-ink/50" />
              <input
                value={newItem}
                placeholder="Add subtask…"
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newItem.trim()) {
                    void app.addChecklistItem(task.id, newItem.trim());
                    setNewItem("");
                  }
                }}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-ink/50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRows(props: { task: Task }) {
  const app = useTwoDoo();
  const { task } = props;
  const [priorityOpen, setPriorityOpen] = useState(false);
  const priorities: Priority[] = ["none", "low", "medium", "high", "urgent"];

  const dateValue = task.startAt ? new Date(new Date(task.startAt).getTime() - new Date(task.startAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
  const endDateValue =
    task.endAt && task.endAt !== task.startAt
      ? new Date(new Date(task.endAt).getTime() - new Date(task.endAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : "";

  return (
    <div className="mt-3 flex flex-col gap-1.5 text-xs">
      <MetaRow icon={<Flag size={12} />}>
        <div className="relative">
          <button className="flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-ink/5" onClick={() => setPriorityOpen((o) => !o)}>
            <PriorityFlag priority={task.priority} />
            <span className={task.priority === "none" ? "text-muted-ink" : "font-medium capitalize"}>{task.priority}</span>
            <ChevronDown size={10} className="text-muted-ink/60" />
          </button>
          {priorityOpen && (
            <div className="absolute left-0 top-7 z-20 w-32 rounded-md border border-outline bg-paper p-1 shadow-lg">
              {priorities.map((p) => (
                <button
                  key={p}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left capitalize hover:bg-ink/5"
                  onClick={() => {
                    void app.updateTask(task.id, { priority: p });
                    setPriorityOpen(false);
                  }}
                >
                  <PriorityFlag priority={p} />
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </MetaRow>

      <MetaRow icon={<Hash size={12} />}>
        <div className="flex flex-wrap items-center gap-1">
          {task.tags.map((tag) => (
            <span key={tag.id} className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600">
              #{tag.name}
            </span>
          ))}
          {task.tags.length === 0 && <span className="text-muted-ink/60">No tags</span>}
        </div>
      </MetaRow>

      <MetaRow icon={<Repeat size={12} />}>
        <span className={task.recurrenceRule ? "font-medium text-violet-600" : "text-muted-ink/60"}>
          {describeRecurrence(task.recurrenceRule) ?? "Does not repeat"}
        </span>
      </MetaRow>

      <MetaRow icon={<ChevronDown size={12} className="rotate-45 text-transparent" />}>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="datetime-local"
            value={dateValue}
            onChange={(e) => {
              const v = e.target.value;
              void app.updateTask(task.id, {
                startAt: v ? new Date(v).toISOString() : null,
                endAt: endDateValue || (v ? new Date(v).toISOString() : null),
                allDay: false,
              });
            }}
            className="rounded-md border border-outline bg-paper px-1.5 py-1 text-xs"
          />
          <input
            type="datetime-local"
            value={endDateValue}
            onChange={(e) => {
              const v = e.target.value;
              void app.updateTask(task.id, { endAt: v ? new Date(v).toISOString() : dateValue ? new Date(dateValue).toISOString() : null });
            }}
            className="rounded-md border border-outline bg-paper px-1.5 py-1 text-xs"
            title="End"
          />
        </div>
      </MetaRow>

      <div className="mt-2">
        <button
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-rose-400 hover:bg-rose-500/10"
          onClick={() => void app.trashTask(task.id).then(props_onClose)}
          title="Move to trash"
        >
          <Trash2 size={11} /> Delete task
        </button>
      </div>
    </div>
  );
  function props_onClose() {
    app.setActiveTaskId(null);
  }
}

function MetaRow(props: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-muted-ink">
      <span className="grid w-4 shrink-0 place-items-center">{props.icon}</span>
      {props.children}
    </div>
  );
}
