import { Check } from "lucide-react";
import { useMembers } from "../../../lib/queries";

export function PersonEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const { data } = useMembers();
  const selected = (value as string[] | null) ?? [];
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="w-[240px] p-1">
      {(data?.members ?? []).map((m) => (
        <button key={m.id} type="button" onClick={() => toggle(m.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-ink/[0.06]">
          <span className="flex size-5 items-center justify-center rounded-full bg-ion/50 text-[10px] font-semibold uppercase">{(m.name || m.email || "?").slice(0, 1)}</span>
          <span className="min-w-0 flex-1 truncate text-left">{m.name || m.email}</span>
          {selected.includes(m.id) ? <Check size={14} className="text-ink-muted" /> : null}
        </button>
      ))}
      {!data?.members.length ? <div className="px-2 py-1.5 text-[13px] text-ink-muted">No workspace members</div> : null}
    </div>
  );
}
