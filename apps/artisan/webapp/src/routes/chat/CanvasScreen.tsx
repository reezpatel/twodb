import { useCallback, useEffect, useState } from "react";
import { FileText, Palette, X } from "lucide-react";
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

/** Session/agent canvas documents. Artisan owns references; Paintress owns the
 * content. Rendered inside the right sidebar (docked) or as a full tab on
 * small viewports — pass onClose for a button that returns to the default
 * sidebar. */
export function CanvasScreen({ sessionId, onClose, hideHeader }: { sessionId: string; onClose?: () => void; hideHeader?: boolean }) {
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
    <div className="flex h-full min-h-0 flex-col">
      {hideHeader ? null : <div className="flex shrink-0 items-center gap-2 border-b border-outline px-3 py-2">
        <Palette className="size-4 shrink-0 text-ink-muted" />
        <span className="text-[13px] font-medium">Canvas</span>
        {onClose ? (
          <button
            type="button"
            aria-label="Back to sidebar"
            title="Back to sidebar"
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>}
      {documents.length > 1 ? (
        <div className="flex shrink-0 flex-wrap gap-1 border-b border-outline px-2 py-1.5">
          {documents.map((document) => (
            <button
              key={document.id}
              type="button"
              onClick={() => setSelectedId(document.id)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[12px] ${selected?.id === document.id ? "bg-surface-muted text-ink" : "text-ink-muted hover:bg-surface-muted/60 hover:text-ink"}`}
            >
              <FileText className="size-3.5 shrink-0" />
              <span className="max-w-40 truncate">{document.title}</span>
            </button>
          ))}
        </div>
      ) : null}
      {selected ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <article className="px-4 py-4">
            <div className="mb-3 flex items-center gap-2 border-b border-outline pb-2">
              <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{selected.title}</h1>
              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-ink-muted">{selected.type}</span>
            </div>
            <Markdown text={selected.markdown} />
          </article>
        </div>
      ) : (
        <div className="flex flex-1 flex-col p-3">
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-outline px-6 py-10 text-center">
            <div className="grid size-10 place-items-center rounded-md bg-stone text-ink-muted">
              <Palette className="size-5" strokeWidth={1.5} />
            </div>
            <div className="text-[15px] font-normal">{loading ? "Loading canvas…" : "No canvas documents yet"}</div>
            {!loading ? (
              <div className="max-w-sm text-sm font-light text-ink-muted">Ask the agent to create a document in Canvas. Documents created with update_canvas appear here.</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

