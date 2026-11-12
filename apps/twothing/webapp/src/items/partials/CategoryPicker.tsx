import { cn } from "@twodb/blocks";
import { CATEGORIES } from "../../lib/catalog";

export function CategoryPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
      {CATEGORIES.map((c) => {
        const active = value === c.id;
        return (
          <button
            type="button"
            key={c.id}
            onClick={() => onChange(c.id)}
            className={cn("flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 text-center text-[11px] leading-tight font-semibold transition active:scale-95", active ? "border-transparent text-white shadow-md" : "border-outline bg-paper text-ink hover:border-ink/25")}
            style={active ? { background: c.color } : undefined}
          >
            <c.icon className="size-5" style={active ? undefined : { color: c.color }} />
            {c.short}
          </button>
        );
      })}
    </div>
  );
}
