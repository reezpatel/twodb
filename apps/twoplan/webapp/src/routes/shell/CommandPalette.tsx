import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@twodb/blocks";
import { FolderKanban, Layers, Ticket } from "lucide-react";
import { useSearch } from "../../lib/queries";

/** ⌘K: searches projects, tickets (title or KEY-n) and epics across the workspace. */
export function CommandPalette({ open, onOpenChange, onGo }: { open: boolean; onOpenChange: (o: boolean) => void; onGo: (path: string) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 150); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (!open) setQ(""); }, [open]);
  const { data } = useSearch(debounced);

  const rows = [
    ...(data?.projects ?? []).map((p) => ({ id: `p${p.id}`, icon: <FolderKanban className="size-4" />, label: p.name, hint: p.key, path: `/p/${p.key}/tickets` })),
    ...(data?.tickets ?? []).map((t) => ({ id: `t${t.id}`, icon: <Ticket className="size-4" />, label: t.title, hint: t.identifier, path: `/p/${t.projectKey}/t/${t.identifier}` })),
    ...(data?.epics ?? []).map((e) => ({ id: `e${e.id}`, icon: <Layers className="size-4" />, label: e.title, hint: `${e.projectKey} · epic`, path: `/p/${e.projectKey}/epics/${e.id}` })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] max-w-xl translate-y-0 gap-0 p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, tickets, epics… (try PLAN-12)"
          onKeyDown={(e) => { if (e.key === "Enter" && rows[0]) onGo(rows[0].path); }}
          className="w-full border-b border-outline bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-ink-muted" />
        <div className="max-h-80 overflow-y-auto p-1">
          {rows.map((r) => (
            <button key={r.id} onClick={() => onGo(r.path)} className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-paper-grid">
              <span className="text-ink-muted">{r.icon}</span><span className="truncate">{r.label}</span><span className="ml-auto shrink-0 font-mono text-xs text-ink-muted">{r.hint}</span>
            </button>
          ))}
          {debounced && !rows.length ? <div className="px-3 py-6 text-center text-sm text-ink-muted">No results</div> : null}
          {!debounced ? <div className="px-3 py-6 text-center text-sm text-ink-muted">Type to search across the workspace</div> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
