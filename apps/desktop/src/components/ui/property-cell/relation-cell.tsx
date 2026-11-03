import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { NoteRecord } from "@/routes/notes/view/use-notes-view";
import type { CellDisplayProps, CellEditProps } from "./types";

/** Rows of the relation's target database (shares the notes view cache). */
function useRelationRows(databaseId: string | undefined) {
  return useQuery({
    queryKey: ["notes", "database", databaseId],
    queryFn: () => api<{ notes: NoteRecord[] }>(`/api/notes/databases/${databaseId}/rows`),
    enabled: !!databaseId,
    select: (d) => d.notes,
  });
}

export function RelationCellDisplay({ value, prop, onActivate }: CellDisplayProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rows = useRelationRows(prop.relation?.databaseId);
  const id = typeof value === "string" && value ? value : null;
  const title = id ? (rows.data?.find((r) => r.noteId === id)?.title || "Untitled") : null;
  return (
    <div
      ref={ref}
      onClick={() => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) onActivate(rect);
      }}
      className="hover:bg-accent/40 -mx-2 flex h-full min-h-[24px] cursor-pointer items-center truncate rounded px-2 text-xs"
    >
      {title ? <span className="bg-muted truncate rounded px-1.5 py-0.5">{rows.isPending ? "…" : title}</span> : null}
    </div>
  );
}

export function RelationCellEdit({ value, prop, position, size, onCommit, onClose }: CellEditProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const rows = useRelationRows(prop.relation?.databaseId);
  const current = typeof value === "string" ? value : null;

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows.data ?? []).filter((r) => !q || r.title.toLowerCase().includes(q)).slice(0, 100);
  }, [rows.data, query]);

  const pick = (id: string | null) => {
    onCommit(id);
    onClose();
  };

  return (
    <div
      ref={ref}
      style={{ position: "fixed", zIndex: 50, left: position.x, top: position.y, minWidth: Math.max(size.width, 220) }}
      className="bg-popover border-input flex max-h-72 flex-col gap-1 rounded-md border p-1 text-xs shadow-md"
    >
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        className="border-input bg-background rounded border px-2 py-1 focus:outline-none"
      />
      <div className="overflow-y-auto">
        {current ? (
          <button type="button" className="hover:bg-accent text-muted-foreground w-full rounded px-2 py-1 text-left" onClick={() => pick(null)}>
            Clear
          </button>
        ) : null}
        {rows.isPending ? <p className="text-muted-foreground px-2 py-1">Loading…</p> : null}
        {matches.map((r) => (
          <button key={r.noteId} type="button" className={`hover:bg-accent w-full truncate rounded px-2 py-1 text-left ${r.noteId === current ? "bg-accent" : ""}`} onClick={() => pick(r.noteId)}>
            {r.title || "Untitled"}
          </button>
        ))}
        {!rows.isPending && matches.length === 0 ? <p className="text-muted-foreground px-2 py-1">No rows</p> : null}
      </div>
    </div>
  );
}
