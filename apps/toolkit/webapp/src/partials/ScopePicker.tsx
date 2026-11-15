import { cn } from "../lib/cn.js";
import type { Scope, Space } from "../lib/toolkit-client.js";

/** Toggle chips: "All spaces" or a multi-select of specific spaces. */
export function ScopePicker({ spaces, value, onChange, disabled }: {
  spaces: Space[];
  value: Scope;
  onChange: (scope: Scope) => void;
  disabled?: boolean;
}) {
  const known = new Set(spaces.map((s) => s.id));
  const chips = [...spaces, ...value.ids.filter((id) => !known.has(id)).map((id) => ({ id, name: id }))];

  const toggle = (id: string) => {
    const has = value.ids.includes(id);
    const next = has ? value.ids.filter((x) => x !== id) : [...value.ids, id];
    onChange({ all: next.length === 0 && value.all ? true : false, ids: next });
    if (next.length > 0) onChange({ all: false, ids: next });
    else onChange({ all: true, ids: [] });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", disabled && "opacity-60")}>
      <Chip active={value.all} onClick={() => !disabled && onChange({ all: true, ids: [] })} disabled={disabled}>
        All spaces
      </Chip>
      <span className="mx-1 text-[11px] text-ink-muted">or</span>
      {chips.map((s) => (
        <Chip key={s.id} active={!value.all && value.ids.includes(s.id)} onClick={() => !disabled && toggle(s.id)} disabled={disabled}>
          {s.name}
        </Chip>
      ))}
    </div>
  );
}

function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
        active ? "border-accent bg-accent/10 text-accent-foreground" : "border-outline/60 text-ink-muted hover:border-outline-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function scopeSummary(scope: Scope, spaces: Space[]): string {
  if (scope.all) return "all spaces";
  const names = scope.ids.map((id) => spaces.find((s) => s.id === id)?.name ?? id);
  return names.join(", ") || "all spaces";
}
