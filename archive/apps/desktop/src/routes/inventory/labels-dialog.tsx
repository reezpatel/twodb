import { createPortal } from "react-dom";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LABEL_SIZES, LabelCard } from "./label-card";
import { useLabels, type LabelRequest } from "./use-labels";

interface LabelsDialogProps {
  request: LabelRequest | null;
  onClose: () => void;
}

export function LabelsDialog({ request, onClose }: LabelsDialogProps) {
  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Print labels</DialogTitle>
          <DialogDescription>Code 128 barcode + QR with the item's or location's barcode — both scan back into this app.</DialogDescription>
        </DialogHeader>
        {request ? <LabelsBody request={request} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function LabelsBody({ request }: { request: LabelRequest }) {
  const l = useLabels(request);
  const printed = l.chosen.flatMap((label) => Array.from({ length: l.copies }, (_, i) => ({ label, key: `${label.id}-${i}` })));
  const selectClass = "border-input bg-background focus:border-ring focus:ring-ring/50 h-8 rounded-md border px-2 text-sm shadow-xs focus:outline-none";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border text-xs">
          {(["item", "location"] as const).map((k) => (
            <button key={k} type="button" onClick={() => l.changeKind(k)} className={`px-3 py-1.5 ${l.kind === k ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>
              {k === "item" ? "Items" : "Locations"}
            </button>
          ))}
        </div>
        <select className={selectClass} value={l.sizeId} onChange={(e) => l.setSizeId(e.target.value)}>
          {LABEL_SIZES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
          Copies
          <Input className="h-8 w-16" type="number" min={1} max={50} value={l.copies} onChange={(e) => l.setCopies(Number(e.target.value))} />
        </label>
        <div className="ml-auto flex gap-1">
          <Button size="xs" variant="ghost" onClick={l.selectAll}>
            All
          </Button>
          <Button size="xs" variant="ghost" onClick={l.selectNone}>
            None
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1.5 text-sm">
          {l.loading ? <Loader2 size={14} className="m-2 animate-spin" /> : null}
          {l.all.map((label) => (
            <li key={label.id}>
              <label className="hover:bg-accent/40 flex cursor-pointer items-center gap-2 rounded px-1.5 py-1">
                <Checkbox checked={l.selected.has(label.id)} onCheckedChange={() => l.toggle(label.id)} />
                <span className="min-w-0 truncate">{label.title || "Untitled"}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="bg-muted/40 max-h-72 overflow-auto rounded-md border p-3">
          {l.chosen.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">Select what to print.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {l.chosen.slice(0, 6).map((label) => (
                <div key={label.id} className="border shadow-sm">
                  <LabelCard label={label} size={l.size} kind={l.kind} />
                </div>
              ))}
              {l.chosen.length > 6 ? <p className="text-muted-foreground self-center text-xs">+{l.chosen.length - 6} more</p> : null}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">{printed.length} label{printed.length === 1 ? "" : "s"}</span>
        <Button disabled={printed.length === 0} onClick={() => window.print()}>
          <Printer /> Print
        </Button>
      </div>

      {printed.length > 0
        ? createPortal(
            <div className="inventory-print-root">
              <style>{`
                .inventory-print-root { display: none; }
                @media print {
                  body > *:not(.inventory-print-root) { display: none !important; }
                  .inventory-print-root { display: grid !important; grid-template-columns: repeat(${l.size.columns}, ${l.size.widthMm}mm); }
                  @page { size: ${l.size.sheet ? "A4" : `${l.size.widthMm}mm ${l.size.heightMm}mm`}; margin: ${l.size.sheet ? "0.5mm 0" : "0"}; }
                  .inventory-print-root .label-card { break-inside: avoid; page-break-after: ${l.size.sheet ? "auto" : "always"}; }
                }
              `}</style>
              {printed.map(({ label, key }) => (
                <LabelCard key={key} label={label} size={l.size} kind={l.kind} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
