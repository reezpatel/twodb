import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@twodb/blocks";
import type { Row } from "@shared/model";
import type { DatabaseViewModel } from "../hooks/useDatabaseView";
import { dayKey } from "../../lib/format";
import { RecordIcon } from "../../ui/RecordIcon";
import { Popover } from "../../ui/Popover";
import { MenuButton } from "../../ui/MenuButton";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7)); // Monday-first
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function CalendarView({ m }: { m: DatabaseViewModel }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const field = m.fields.find((f) => f.id === m.view?.config.calendar?.dateFieldId);
  const editable = field?.type === "date";

  const valueOf = (r: Row) => (field?.id === "created_time" ? r.createdAt : field?.id === "updated_time" ? r.updatedAt : (r.values[field?.id ?? ""] as string | null));
  const byDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of m.rows) {
      const v = field ? valueOf(r) : null;
      if (!v) continue;
      const k = dayKey(new Date(v));
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return map;
  }, [m.rows, field]); // eslint-disable-line react-hooks/exhaustive-deps
  const undated = field ? m.rows.filter((r) => !valueOf(r)) : [];

  if (!field)
    return (
      <div className="rounded-lg border border-dashed border-outline p-6 text-[13.5px] text-ink-muted">
        Pick a date property for this calendar:
        <div className="mt-2 max-w-[240px]">
          {m.fields
            .filter((f) => f.type === "date" || f.type === "created_time" || f.type === "updated_time")
            .map((f) => (
              <MenuButton key={f.id} onClick={() => void m.updateConfig({ calendar: { dateFieldId: f.id } })}>
                {f.name}
              </MenuButton>
            ))}
        </div>
      </div>
    );

  const atNoon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();
  const today = dayKey(new Date());
  const days = monthGrid(month);

  return (
    <div className="pb-3">
      <div className="mb-2 flex items-center gap-1">
        <span className="mr-2 text-[15px] font-semibold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="flex size-7 items-center justify-center rounded-md text-ink-muted hover:bg-ink/[0.06]" aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="h-7 rounded-md px-2 text-[13px] text-ink-muted hover:bg-ink/[0.06]">
          Today
        </button>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="flex size-7 items-center justify-center rounded-md text-ink-muted hover:bg-ink/[0.06]" aria-label="Next month">
          <ChevronRight size={16} />
        </button>
        {undated.length ? (
          <Popover trigger={<button type="button" className="ml-auto h-7 rounded-md px-2 text-[12.5px] text-ink-muted hover:bg-ink/[0.06]">{undated.length} without date</button>} align="end">
            <div className="max-h-[300px] w-[240px] overflow-y-auto p-1">
              {undated.map((r) => (
                <div key={r.id} draggable={editable} onDragStart={() => setDrag(r.id)}>
                  <MenuButton icon={<RecordIcon icon={r.icon} kind="page" size={14} />} onClick={() => m.openRow(r.id)}>
                    {r.title || "Untitled"}
                  </MenuButton>
                </div>
              ))}
            </div>
          </Popover>
        ) : null}
      </div>
      <div className="grid grid-cols-7 border-l border-t border-outline/70">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-b border-r border-outline/70 px-2 py-1 text-[11.5px] font-medium text-ink-muted">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const k = dayKey(d);
          const items = byDay.get(k) ?? [];
          const inMonth = d.getMonth() === month.getMonth();
          return (
            <div
              key={k}
              onDragOver={(e) => editable && (e.preventDefault(), setOver(k))}
              onDragLeave={() => setOver((o) => (o === k ? null : o))}
              onDrop={() => {
                if (drag && editable) void m.setValue(drag, field.id, atNoon(d));
                setDrag(null);
                setOver(null);
              }}
              className={cn("group/day min-h-[104px] border-b border-r border-outline/70 p-1", !inMonth && "bg-ink/[0.02]", over === k && "bg-ion/20")}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={cn("flex size-6 items-center justify-center rounded-full text-[12px]", k === today ? "bg-pin font-semibold text-paper" : inMonth ? "text-ink" : "text-ink-muted/60")}>{d.getDate()}</span>
                {editable ? (
                  <button type="button" onClick={() => void m.addRow({ [field.id]: atNoon(d) }, { open: true })} className="flex size-5 items-center justify-center rounded text-ink-muted opacity-0 hover:bg-ink/[0.06] group-hover/day:opacity-100" aria-label="Add">
                    <Plus size={13} />
                  </button>
                ) : null}
              </div>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 4).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    draggable={editable}
                    onDragStart={() => setDrag(r.id)}
                    onClick={() => m.openRow(r.id)}
                    className="flex items-center gap-1 truncate rounded-[5px] border border-outline bg-paper px-1.5 py-0.5 text-left text-[12px] hover:border-ink/25"
                  >
                    <RecordIcon icon={r.icon} kind="page" size={12} />
                    <span className="truncate">{r.title || "Untitled"}</span>
                  </button>
                ))}
                {items.length > 4 ? <span className="px-1 text-[11px] text-ink-muted">+{items.length - 4} more</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
