import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { CornerDownLeft, Plus, Search } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, cn } from "@twodb/blocks";
import { api } from "../lib/api";
import { useGarden } from "../lib/queries";
import { RecordIcon } from "../ui/RecordIcon";

/** ⌘K: full-text search across notes + databases, or create a page from the query. */
export function QuickSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const garden = useGarden();
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 150);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);
  const { data } = useQuery({ queryKey: ["quick-search", debounced], queryFn: () => api.search(debounced, { limit: 20 }), enabled: open, placeholderData: keepPreviousData });
  const hits = data?.hits ?? [];
  const items = [...hits.map((h) => ({ kind: "hit" as const, h })), ...(q.trim() ? [{ kind: "create" as const }] : [])];
  useEffect(() => setActive(0), [debounced]);

  const choose = async (i: number) => {
    const it = items[i];
    if (!it) return;
    onOpenChange(false);
    if (it.kind === "hit") navigate(`/${it.h.id}`);
    else {
      const p = await garden.createPage({ title: q.trim() });
      navigate(`/${p.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[18%] w-[min(640px,94vw)] max-w-none translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2 border-b border-outline px-4">
          <Search size={16} className="text-ink-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, items.length - 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
              if (e.key === "Enter") (e.preventDefault(), void choose(active));
            }}
            placeholder="Search docs or type to create…"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-muted"
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1.5">
          {!q && hits.length ? <div className="px-2 pb-1 pt-1 text-[11.5px] font-semibold text-ink-muted">Recent</div> : null}
          {items.map((it, i) =>
            it.kind === "hit" ? (
              <button key={it.h.id} type="button" onMouseEnter={() => setActive(i)} onClick={() => void choose(i)} className={cn("flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left", i === active && "bg-ink/[0.06]")}>
                <RecordIcon icon={it.h.icon} kind={it.h.kind} size={16} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium">{it.h.title || "Untitled"}</span>
                    {it.h.parentTitle ? <span className="truncate text-[12px] text-ink-muted">in {it.h.parentTitle}</span> : null}
                  </span>
                  {it.h.snippet ? <span className="block truncate text-[12.5px] text-ink-muted">{it.h.snippet}</span> : null}
                </span>
                {i === active ? <CornerDownLeft size={13} className="mt-1 text-ink-muted" /> : null}
              </button>
            ) : (
              <button key="create" type="button" onMouseEnter={() => setActive(i)} onClick={() => void choose(i)} className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px]", i === active && "bg-ink/[0.06]")}>
                <Plus size={16} className="text-ink-muted" /> New page “{q.trim()}”
              </button>
            ),
          )}
          {q && !hits.length ? <div className="px-3 py-2 text-[13px] text-ink-muted">No matches</div> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
