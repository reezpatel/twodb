import { cn } from "@twodb/blocks";
import { CircleAlert, CircleCheck, Loader2, TriangleAlert, Undo2 } from "lucide-react";
import { displayCode } from "../../lib/format";
import { MatchCard, NoMatchCard, type MatchHandlers } from "../../ui/MatchCard";
import type { ScanEntry } from "../hooks/useScanSession";

export function ScanEntryView({
  entry,
  latest,
  h,
  onUndo,
  onSearch,
}: {
  entry: ScanEntry;
  latest: boolean;
  h: MatchHandlers;
  onUndo: () => void;
  onSearch: () => void;
}) {
  const OutIcon = entry.outcome?.tone === "ok" ? CircleCheck : entry.outcome?.tone === "warn" ? TriangleAlert : CircleAlert;
  const choosing = entry.matches.filter((m) => m.type === "item").length > 1 && !!h.onChoose;
  return (
    <div className={cn("space-y-2 transition-opacity", !latest && "opacity-70 hover:opacity-100")}>
      <div className="flex items-center gap-2 px-1 text-xs text-ink-muted">
        {entry.status === "pending" && <Loader2 className="size-3 animate-spin" />}
        <span className="font-mono tracking-wide">{displayCode(entry.raw).slice(0, 48)}</span>
        <span className="ml-auto">{new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </div>
      {entry.outcome && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
            entry.outcome.tone === "ok" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            entry.outcome.tone === "warn" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            entry.outcome.tone === "error" && "bg-rose-500/10 text-rose-700 dark:text-rose-300",
          )}
        >
          <OutIcon className="size-4 shrink-0" />
          <span className="flex-1">{entry.outcome.text}</span>
          {entry.undo && (
            <button className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold hover:bg-black/5" onClick={onUndo}>
              <Undo2 className="size-3" /> Undo
            </button>
          )}
        </div>
      )}
      {entry.status === "done" &&
        (entry.matches.length ? (
          entry.matches.map((m, i) => <MatchCard key={i} match={m} h={h} choosing={choosing} />)
        ) : (
          <NoMatchCard raw={entry.raw} onNewItem={() => h.onNewItem({ barcode: entry.raw })} onSearch={onSearch} />
        ))}
    </div>
  );
}
