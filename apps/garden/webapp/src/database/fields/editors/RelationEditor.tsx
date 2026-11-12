import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import type { Field, RecordRef } from "@shared/model";
import { api } from "../../../lib/api";
import { useGarden } from "../../../lib/queries";
import { RecordIcon } from "../../../ui/RecordIcon";

/** Search rows of the target database, toggle links, or create a new row inline. */
export function RelationEditor({ field, value, relations, onChange }: { field: Field; value: unknown; relations?: Record<string, RecordRef>; onChange: (v: unknown) => void }) {
  const garden = useGarden();
  const target = field.config.relation?.databaseId;
  const [q, setQ] = useState("");
  const selected = (value as string[] | null) ?? [];
  const { data } = useQuery({ queryKey: ["relation-search", target, q], queryFn: () => api.search(q, { databaseId: target, limit: 30 }), enabled: !!target });
  const [known, setKnown] = useState<Record<string, RecordRef>>({});
  const ref = (id: string) => known[id] ?? relations?.[id] ?? data?.hits.find((h) => h.id === id);
  const limitOne = field.config.relation?.limitOne;

  const toggle = (r: RecordRef) => {
    setKnown((k) => ({ ...k, [r.id]: r }));
    if (limitOne) onChange(selected[0] === r.id ? [] : [r.id]);
    else onChange(selected.includes(r.id) ? selected.filter((x) => x !== r.id) : [...selected, r.id]);
  };
  const create = async () => {
    if (!target) return;
    const page = await garden.createPage({ parentId: target, title: q.trim() });
    toggle({ id: page.id, kind: "page", title: page.title, icon: page.icon });
    setQ("");
  };

  return (
    <div className="w-[300px]">
      <div className="border-b border-outline p-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && q.trim() && !data?.hits.length && void create()}
          placeholder="Search for a page…"
          className="h-7 w-full rounded-md bg-ink/[0.04] px-2 text-[13px] outline-none placeholder:text-ink-muted"
        />
      </div>
      {selected.length ? (
        <div className="border-b border-outline p-1">
          {selected.map((id) => {
            const r = ref(id);
            return (
              <div key={id} className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] hover:bg-ink/[0.04]">
                <RecordIcon icon={r?.icon} kind="page" size={14} />
                <span className="min-w-0 flex-1 truncate">{r?.title || "Untitled"}</span>
                <button type="button" onClick={() => onChange(selected.filter((x) => x !== id))} className="text-ink-muted hover:text-ink" aria-label="Unlink">
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="max-h-[240px] overflow-y-auto p-1">
        {(data?.hits ?? [])
          .filter((h) => !selected.includes(h.id))
          .map((h) => (
            <button key={h.id} type="button" onClick={() => toggle(h)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-ink/[0.06]">
              <RecordIcon icon={h.icon} kind="page" size={14} />
              <span className="min-w-0 flex-1 truncate">{h.title || "Untitled"}</span>
            </button>
          ))}
        {q.trim() ? (
          <button type="button" onClick={() => void create()} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-ink/[0.06]">
            <Plus size={14} className="text-ink-muted" /> New page “{q.trim()}”
          </button>
        ) : null}
        {!target ? <div className="px-2 py-1.5 text-[13px] text-ink-muted">Relation has no target database</div> : null}
      </div>
    </div>
  );
}
