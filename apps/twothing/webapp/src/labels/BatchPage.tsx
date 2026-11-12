import { useMemo, useState } from "react";
import { cn } from "@twodb/blocks";
import { api } from "../lib/api";
import { useQuery } from "../lib/query";
import { Link } from "../lib/router";
import { Page, PageHeader, Spinner } from "../ui/Page";
import { PrintStudio } from "./PrintStudio";

/** A print batch: reprint all or only the still-unused codes. */
export function BatchPage({ id }: { id: string }) {
  const { data, loading, error } = useQuery(`batch:${id}`, () => api.batch(id));
  const [unusedOnly, setUnusedOnly] = useState(true);
  const codes = data?.codes ?? [];
  const used = codes.filter((c) => c.usedBy);
  const labels = useMemo(() => (unusedOnly ? codes.filter((c) => !c.usedBy) : codes).map((c) => ({ code: c.code, display: c.display })), [codes, unusedOnly]);

  if (error) return <Page><PageHeader title="Batch not found" onBack="/labels" /></Page>;
  if (loading || !data) return <Spinner />;
  return (
    <Page wide>
      <PageHeader
        onBack="/labels"
        title={data.batch.note || `${data.batch.count} labels`}
        subtitle={`Generated ${new Date(data.batch.createdAt).toLocaleString()} · ${used.length} of ${codes.length} in use`}
      />
      <PrintStudio labels={labels}>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-outline bg-paper p-1">
          {[true, false].map((v) => (
            <button key={String(v)} onClick={() => setUnusedOnly(v)} className={cn("rounded-lg py-1.5 text-sm font-semibold", unusedOnly === v ? "bg-ink text-paper" : "text-ink-muted hover:text-ink")}>
              {v ? `Unused (${codes.length - used.length})` : `All (${codes.length})`}
            </button>
          ))}
        </div>
        {used.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-ink-muted">Used codes</summary>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {used.map((c) => (
                <li key={c.code} className="flex gap-2">
                  <span className="font-mono text-xs font-semibold">{c.display}</span>
                  <Link className="truncate hover:underline" to={`/${c.usedBy!.kind === "item" ? "items" : "places"}/${c.usedBy!.id}`}>
                    {c.usedBy!.name}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </PrintStudio>
    </Page>
  );
}
