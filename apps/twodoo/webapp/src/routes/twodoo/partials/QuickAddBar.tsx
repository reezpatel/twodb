import { useMemo, useState } from "react";
import { cn } from "@twodb/blocks";
import { CornerDownLeft, Plus } from "lucide-react";
import { useTwoDoo } from "../hooks/useTwoDoo";
import { parseQuickAdd, describeRecurrence } from "../../../lib/quick-add";
import { formatDue } from "../../../lib/quick-add";
import { collectLists } from "../hooks/useTwoDoo";

/**
 * Smart quick-add: TickTick-style syntax parsed live into chips.
 * #tag / #list  @assignee  !..!!!!  date+time phrases  every-day recurrence
 */
export function QuickAddBar(props: { defaultListId?: string | null }) {
  const app = useTwoDoo();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const lists = useMemo(() => collectLists(app.boards), [app.boards]);
  const parsed = useMemo(() => parseQuickAdd(raw, lists.map((l) => l.name)), [raw, lists]);

  const targetListId =
    props.defaultListId && lists.some((l) => l.id === props.defaultListId)
      ? props.defaultListId
      : lists[0]?.id;
  const targetList = lists.find((l) => l.id === targetListId);

  const submit = async () => {
    if (!raw.trim() || !targetListId || busy) return;
    setBusy(true);
    try {
      await app.quickAdd(raw, targetListId);
      setRaw("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 pb-2">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-outline bg-paper px-3 py-2 shadow-sm transition-colors",
          raw && "border-ion/50",
        )}
      >
        <Plus size={15} className="shrink-0 text-muted-ink" />
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
            if (e.key === "Escape") setRaw("");
          }}
          onFocus={() => setShowHelp(true)}
          onBlur={() => setTimeout(() => setShowHelp(false), 150)}
          placeholder={targetList ? `Add task to "${targetList.name}"…` : "Add task…"}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-ink/60"
        />
        {raw && (
          <button
            className={cn("grid size-6 shrink-0 place-items-center rounded-md bg-ion text-paper", busy && "opacity-50")}
            onClick={() => void submit()}
            title="Add (Enter)"
          >
            <CornerDownLeft size={12} />
          </button>
        )}
      </div>

      {raw && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-[11px]">
          <Chip tone="ink">{parsed.title || "…"}</Chip>
          {parsed.priority !== "none" && <Chip tone="amber">priority: {parsed.priority}</Chip>}
          {parsed.startAt && <Chip tone="sky">{formatDue(parsed.startAt, parsed.endAt, parsed.allDay)}</Chip>}
          {parsed.recurrenceRule && <Chip tone="violet">{describeRecurrence(parsed.recurrenceRule)}</Chip>}
          {parsed.tags
            .filter((t) => !t.startsWith("@list:"))
            .map((t) => (
              <Chip key={t} tone="emerald">#{t}</Chip>
            ))}
          {parsed.tags
            .filter((t) => t.startsWith("@list:"))
            .map((t) => (
              <Chip key={t} tone="emerald">→ {t.slice(6)}</Chip>
            ))}
          {parsed.assignee && <Chip tone="rose">@{parsed.assignee}</Chip>}
        </div>
      )}

      {showHelp && !raw && (
        <div className="mt-1.5 px-1 text-[11px] leading-relaxed text-muted-ink/80">
          <code>#tag</code> · <code>#list-name</code> routes · <code>@person</code> · <code>!</code>–<code>!!!!</code> priority ·{" "}
          <code>today</code> <code>tomorrow</code> <code>fri</code> <code>next mon</code> <code>in 3 days</code> <code>5pm</code> <code>9-11</code> ·{" "}
          <code>every mon</code> <code>daily</code> <code>every 2 weeks</code>
        </div>
      )}
    </div>
  );
}

function Chip(props: { children: React.ReactNode; tone: "ink" | "amber" | "sky" | "emerald" | "rose" | "violet" }) {
  const tones: Record<string, string> = {
    ink: "bg-ink/5 text-ink/80",
    amber: "bg-amber-500/10 text-amber-600",
    sky: "bg-sky-500/10 text-sky-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    rose: "bg-rose-500/10 text-rose-500",
    violet: "bg-violet-500/10 text-violet-600",
  };
  return <span className={cn("rounded-full px-2 py-0.5 font-medium", tones[props.tone])}>{props.children}</span>;
}
