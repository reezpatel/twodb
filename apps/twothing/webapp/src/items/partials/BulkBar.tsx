import { MoveRight, Printer, X } from "lucide-react";

export function BulkBar({ count, onMove, onPrint, onAll, onCancel }: { count: number; onMove: () => void; onPrint: () => void; onAll: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-lg animate-in items-center gap-2 rounded-full bg-[#1d1c1a] p-1.5 pl-4 text-sm text-white shadow-2xl slide-in-from-bottom-4 md:bottom-6">
      <span className="font-semibold tabular-nums">{count} selected</span>
      <button onClick={onAll} className="text-xs text-white/60 hover:text-white">
        all
      </button>
      <div className="ml-auto flex gap-1">
        <button disabled={!count} onClick={onMove} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-black disabled:opacity-40">
          <MoveRight className="size-4" /> Move
        </button>
        <button disabled={!count} onClick={onPrint} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold hover:bg-white/10 disabled:opacity-40">
          <Printer className="size-4" /> Labels
        </button>
        <button aria-label="Cancel selection" onClick={onCancel} className="grid size-8 place-items-center rounded-full hover:bg-white/10">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
