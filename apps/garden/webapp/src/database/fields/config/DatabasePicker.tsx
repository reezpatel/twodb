import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useTree } from "../../../lib/queries";
import { RecordIcon } from "../../../ui/RecordIcon";

/** Pick a database (relation target). Includes the space's Notes database ("All docs"). */
export function DatabasePicker({ onPick }: { onPick: (id: string, title: string) => void }) {
  const [q, setQ] = useState("");
  const tree = useTree();
  const { data } = useQuery({ queryKey: ["db-search", q], queryFn: () => api.search(q, { kind: "database", limit: 30 }) });
  const notes = tree.data?.defaultDatabaseId;
  return (
    <div className="w-[260px]">
      <div className="border-b border-outline p-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Link to a database…" className="h-7 w-full rounded-md bg-ink/[0.04] px-2 text-[13px] outline-none placeholder:text-ink-muted" />
      </div>
      <div className="max-h-[260px] overflow-y-auto p-1">
        {notes && (!q || "all docs notes".includes(q.toLowerCase())) ? (
          <button type="button" onClick={() => onPick(notes, "All docs")} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-ink/[0.06]">
            <RecordIcon kind="database" size={14} /> All docs
          </button>
        ) : null}
        {(data?.hits ?? []).map((h) => (
          <button key={h.id} type="button" onClick={() => onPick(h.id, h.title)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-ink/[0.06]">
            <RecordIcon icon={h.icon} kind="database" size={14} />
            <span className="min-w-0 flex-1 truncate">{h.title || "Untitled"}</span>
            {h.parentTitle ? <span className="max-w-[90px] truncate text-[11px] text-ink-muted">{h.parentTitle}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
