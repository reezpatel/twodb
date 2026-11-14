import { Check } from "lucide-react";
import { cn } from "../../../lib/cn.js";
import type { SpaceInfo } from "../../../lib/artisan-client.js";

/** Pick one or more spaces (at least one stays selected). Rendered as toggle chips. */
export function SpaceMultiSelect({ spaces, value, onChange, disabled }: {
  spaces: SpaceInfo[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  // Keep ids that no longer resolve to a known space visible so they can be removed.
  const known = new Set(spaces.map((s) => s.id));
  const all = [...spaces, ...value.filter((id) => !known.has(id)).map((id) => ({ id, name: id }))];
  const toggle = (id: string) => {
    if (disabled) return;
    if (value.includes(id)) {
      if (value.length > 1) onChange(value.filter((x) => x !== id));
    } else onChange([...value, id]);
  };
  if (all.length === 0) return <span className="text-[12px] text-ink-muted">default</span>;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {all.map((s) => {
        const on = value.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => toggle(s.id)}
            className={cn(
              "flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] transition-colors disabled:cursor-default",
              on ? "bg-primary/15 text-ink" : "bg-surface-muted text-ink-muted hover:text-ink",
            )}
          >
            {on ? <Check className="size-3" /> : null}
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
