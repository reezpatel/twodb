import { ScanLine, Trash2 } from "lucide-react";
import { useScanOverlay, type OverlayRequest } from "./hooks/useScanOverlay";
import { ManualEntry } from "./partials/ManualEntry";
import { ModeTabs } from "./partials/ModeTabs";
import { ScanEntryView } from "./partials/ScanEntryView";
import { ScanHeader } from "./partials/ScanHeader";
import { TargetBanner } from "./partials/TargetBanner";
import { Viewfinder } from "./partials/Viewfinder";

export function ScanOverlay({ request, onClose }: { request: OverlayRequest; onClose: () => void }) {
  const o = useScanOverlay(request, onClose);
  const s = o.session;
  return (
    <div className="fixed inset-0 z-[70] flex animate-in flex-col bg-black fade-in-0 md:flex-row" role="dialog" aria-modal="true" aria-label={o.title}>
      <div className="relative h-[46dvh] shrink-0 md:h-full md:flex-1">
        <Viewfinder videoRef={o.camera.videoRef} status={o.camera.status} error={o.camera.error} hitKey={o.hitKey} onStart={() => void o.camera.start()} />
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent pb-6">
          <ScanHeader
            title={o.title}
            subtitle={o.subtitle}
            torch={o.camera.torch}
            onTorch={() => void o.camera.toggleTorch()}
            canSwitch={o.camera.canSwitch}
            onSwitch={o.camera.switchCamera}
            onClose={o.cancel}
          />
        </div>
        {!o.isPick && (
          <div className="absolute inset-x-3 bottom-7 md:bottom-4 md:mx-auto md:max-w-md">
            <ModeTabs mode={s.mode} onChange={s.setMode} />
          </div>
        )}
      </div>

      <div className="relative z-10 -mt-4 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-paper text-ink md:mt-0 md:w-[440px] md:flex-none md:rounded-none md:border-l md:border-outline">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-outline md:hidden" />
        <div className="space-y-3 p-3">
          {!o.isPick && s.mode === "putaway" && <TargetBanner target={s.target} onClear={() => s.setTarget(null)} />}
          <ManualEntry value={o.manual} onChange={o.setManual} onSubmit={o.submitManual} />
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-6">
          {o.isPick ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-ink-muted">
              <ScanLine className="size-8" />
              Point the camera at the code — it'll be filled in automatically.
            </div>
          ) : s.entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-ink-muted">
              <ScanLine className="size-8" />
              <div>
                {s.mode === "lookup" && "Scan a label, a box, or a product's own barcode / QR."}
                {s.mode === "putaway" && "Scan the box, then each thing going into it. Fast sorting!"}
                {s.mode === "stockIn" && "Each scan adds one to that item's stock."}
                {s.mode === "stockOut" && "Each scan takes one from that item's stock."}
              </div>
              <div className="text-xs">USB/Bluetooth scanners work too — just scan.</div>
            </div>
          ) : (
            <>
              {s.entries.map((e, i) => (
                <ScanEntryView key={e.id} entry={e} latest={i === 0} h={o.handlers} onUndo={() => void s.runUndo(e)} onSearch={() => o.onSearch(e.raw)} />
              ))}
              <button onClick={s.clear} className="mx-auto flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
                <Trash2 className="size-3" /> Clear history
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
