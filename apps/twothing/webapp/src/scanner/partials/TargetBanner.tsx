import { MapPin, X } from "lucide-react";
import { pathText } from "../../lib/format";
import type { Target } from "../hooks/useScanSession";

export function TargetBanner({ target, onClear }: { target: Target | null; onClear: () => void }) {
  if (!target)
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2.5 text-sm">
        <MapPin className="size-4 text-amber-600" />
        <span>
          <b>Scan a box or place label</b> first, then scan the things that go in it.
        </span>
      </div>
    );
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm">
      <MapPin className="size-4 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Putting away into</div>
        <div className="truncate font-semibold">{pathText(target.path) || target.name}</div>
      </div>
      <button aria-label="Clear target" className="rounded-full p-1.5 hover:bg-black/5" onClick={onClear}>
        <X className="size-4" />
      </button>
    </div>
  );
}
