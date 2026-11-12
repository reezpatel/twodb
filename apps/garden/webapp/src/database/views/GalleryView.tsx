import { Plus } from "lucide-react";
import type { Row } from "@shared/model";
import type { DatabaseViewModel } from "../hooks/useDatabaseView";
import { RowCard } from "../partials/RowCard";

const COLS = { small: "minmax(180px,1fr)", medium: "minmax(240px,1fr)", large: "minmax(320px,1fr)" };
const COVER_H = { small: 100, medium: 140, large: 190 };

function Cover({ row, height }: { row: Row; height: number }) {
  if (row.cover)
    return row.cover.startsWith("/") || row.cover.startsWith("http") ? (
      <img src={row.cover} alt="" className="w-full border-b border-outline object-cover" style={{ height }} />
    ) : (
      <div className="w-full border-b border-outline" style={{ height, background: row.cover }} />
    );
  return (
    <div className="overflow-hidden border-b border-outline bg-ink/[0.025] px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-muted" style={{ height }}>
      {row.preview || <span className="opacity-60">Empty page</span>}
    </div>
  );
}

export function GalleryView({ m }: { m: DatabaseViewModel }) {
  const size = m.view?.config.gallery?.size ?? "medium";
  const showCover = (m.view?.config.gallery?.cover ?? "page") !== "none";
  return (
    <div className="grid gap-3 pb-3" style={{ gridTemplateColumns: `repeat(auto-fill, ${COLS[size]})` }}>
      {m.rows.map((r) => (
        <RowCard key={r.id} row={r} fields={m.visible} relations={m.relations} onOpen={() => m.openRow(r.id)} cover={showCover ? <Cover row={r} height={COVER_H[size]} /> : undefined} />
      ))}
      <button type="button" onClick={() => void m.addRow({}, { open: true })} className="flex min-h-[90px] items-center justify-center gap-1.5 rounded-[9px] border border-dashed border-outline text-[13px] text-ink-muted hover:bg-ink/[0.03] hover:text-ink">
        <Plus size={15} /> New page
      </button>
    </div>
  );
}
