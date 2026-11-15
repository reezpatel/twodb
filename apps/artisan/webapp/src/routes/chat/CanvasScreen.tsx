import { useCallback, useEffect, useState } from "react";
import { FileText, Palette } from "lucide-react";
import { Markdown } from "@twodb/blocks";
import { apiFetch } from "../../lib/artisan-client.js";

interface CanvasDocument {
  id: string;
  title: string;
  type: string;
  resourceId: string;
  markdown: string;
  version: number;
  updatedAt: string;
}

/** Session/agent canvas list. Artisan owns references; Paintress owns the documents. */
export function CanvasScreen({ sessionId }: { sessionId: string }) {
  const [documents, setDocuments] = useState<CanvasDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch(`/sessions/${sessionId}/canvases`);
      if (!response.ok) return;
      const rows = (await response.json()) as CanvasDocument[];
      setDocuments(rows);
      setSelectedId((current) => (current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setLoading(true);
    void load();
    const onCanvas = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail;
      if (!detail?.sessionId || detail.sessionId === sessionId) void load();
    };
    window.addEventListener("artisan:canvas-updated", onCanvas);
    return () => window.removeEventListener("artisan:canvas-updated", onCanvas);
  }, [load, sessionId]);

  const selected = documents.find((row) => row.id === selectedId) ?? documents[0] ?? null;

  return (
    <div className="flex min-h-0 flex-1 bg-paper">
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-outline bg-surface">
        <div className="flex items-center gap-2 border-b border-outline px-3 py-2 text-sm font-medium">
          <Palette className="size-4 text-ink-muted" /> Canvas
        </div>
        {documents.map((document) => (
          <button
            key={document.id}
            type="button"
            onClick={() => setSelectedId(document.id)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${selected?.id === document.id ? "bg-surface-muted text-ink" : "text-ink-muted hover:bg-surface-muted/60 hover:text-ink"}`}
          >
            <FileText className="size-4 shrink-0" />
            <span className="truncate">{document.title}</span>
          </button>
        ))}
      </aside>

      {selected ? (
        <div className="min-w-0 flex-1 overflow-y-auto">
          <article className="mx-auto max-w-3xl px-8 py-8">
            <div className="mb-5 flex items-center gap-2 border-b border-outline pb-3">
              <h1 className="text-xl font-semibold">{selected.title}</h1>
              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-ink-muted">{selected.type}</span>
            </div>
            <Markdown text={selected.markdown} />
          </article>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <Palette className="size-7 text-ink-muted/40" />
          <p className="text-sm font-medium text-ink-muted">{loading ? "Loading canvas…" : "No canvas documents yet"}</p>
          {!loading ? <p className="max-w-sm text-xs text-ink-muted/70">Ask the agent to create a document in Canvas. Documents created with update_canvas appear here.</p> : null}
        </div>
      )}
    </div>
  );
}
