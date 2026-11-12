import { Barcode, ScanBarcode, X } from "lucide-react";

/** Manufacturer barcodes / product QR payloads. Enter adds (USB scanners type + Enter too). */
export function BarcodeField({ barcodes, onAdd, onRemove, onScan }: { barcodes: string[]; onAdd: (b: string) => void; onRemove: (b: string) => void; onScan: () => void }) {
  return (
    <div className="space-y-2">
      {barcodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {barcodes.map((b) => (
            <span key={b} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-outline bg-paper py-1 pr-1 pl-2 font-mono text-xs">
              <Barcode className="size-3.5 shrink-0 text-ink-muted" />
              <span className="truncate" title={b}>
                {b}
              </span>
              <button type="button" aria-label="Remove barcode" onClick={() => onRemove(b)} className="rounded p-0.5 hover:bg-stone">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          placeholder="Type or scan EAN / UPC / QR, Enter to add"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd(e.currentTarget.value);
              e.currentTarget.value = "";
            }
          }}
          className="h-10 min-w-0 flex-1 rounded-xl border border-outline bg-paper px-3 font-mono text-sm outline-none placeholder:font-sans placeholder:text-ink-muted focus:border-ink/30"
        />
        <button type="button" onClick={onScan} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-outline bg-paper px-3 text-sm font-semibold hover:bg-stone active:scale-95">
          <ScanBarcode className="size-4" /> Scan
        </button>
      </div>
    </div>
  );
}
