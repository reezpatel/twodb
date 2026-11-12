import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@twodb/blocks";
import type { RowGroup } from "../lib/view-utils";
import { OptionPill } from "../fields/OptionPill";

export function GroupHeader({ group, collapsed, onToggle, onAdd }: { group: RowGroup; collapsed: boolean; onToggle: () => void; onAdd?: () => void }) {
  return (
    <div className="group/gh flex h-9 items-center gap-1.5 px-1">
      <button type="button" onClick={onToggle} className="flex size-5 items-center justify-center rounded text-ink-muted hover:bg-ink/[0.06]">
        <ChevronRight size={14} className={cn("transition-transform", !collapsed && "rotate-90")} />
      </button>
      {group.option ? <OptionPill option={group.option} /> : <span className="text-[13.5px] font-medium">{group.label}</span>}
      <span className="text-[12.5px] text-ink-muted">{group.rows.length}</span>
      {onAdd ? (
        <button type="button" onClick={onAdd} className="ml-1 flex size-5 items-center justify-center rounded text-ink-muted opacity-0 hover:bg-ink/[0.06] group-hover/gh:opacity-100" aria-label="Add to group">
          <Plus size={14} />
        </button>
      ) : null}
    </div>
  );
}
