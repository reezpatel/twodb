import { RotateCcw, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useGarden, useTrash } from "../lib/queries";
import { relativeTime } from "../lib/format";
import { RecordIcon } from "../ui/RecordIcon";
import { IconButton } from "../ui/IconButton";
import { HeaderBar } from "../shell/partials/HeaderBar";

export function TrashPage() {
  const { data, isLoading } = useTrash();
  const garden = useGarden();
  const navigate = useNavigate();
  const items = data?.items ?? [];
  return (
    <div className="flex h-full flex-col">
      <HeaderBar title="Trash" />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-16 pt-10 sm:px-16">
        <div className="mx-auto max-w-[880px]">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h1 className="text-[32px] font-bold tracking-[-0.02em]">Trash</h1>
              <p className="text-[13.5px] text-ink-muted">Pages and databases you deleted, with everything inside them.</p>
            </div>
            {items.length ? (
              <button type="button" onClick={() => window.confirm("Permanently delete everything in Trash?") && void garden.emptyTrash()} className="rounded-md border border-outline px-2.5 py-1 text-[13px] text-destructive hover:bg-destructive/10">
                Empty trash
              </button>
            ) : null}
          </div>
          <div className="border-t border-outline/70">
            {items.map((it) => (
              <div key={it.id} className="group flex items-center gap-3 border-b border-outline/70 px-2 py-2.5 hover:bg-ink/[0.02]">
                <button type="button" onClick={() => navigate(`/${it.id}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <RecordIcon icon={it.icon} kind={it.kind} size={16} />
                  <span className="truncate text-[14px] font-medium">{it.title || "Untitled"}</span>
                  {it.parentTitle ? <span className="truncate text-[12.5px] text-ink-muted">in {it.parentTitle}</span> : null}
                </button>
                <span className="text-[12px] text-ink-muted">{relativeTime(it.deletedAt)}</span>
                <IconButton title="Restore" onClick={() => void garden.restore(it.id)}>
                  <RotateCcw size={15} />
                </IconButton>
                <IconButton title="Delete forever" onClick={() => window.confirm(`Permanently delete “${it.title || "Untitled"}”?`) && void garden.deleteForever(it.id)}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            ))}
            {!isLoading && !items.length ? <div className="py-16 text-center text-[13.5px] text-ink-muted">Trash is empty</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
