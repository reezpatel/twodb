import { useEffect, useState } from "react";
import { Camera, CameraOff, Loader2, MapPin, Minus, Plus, ScanLine, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatQuantity, type ResolveMatch } from "./inventory-api";
import { ItemThumb } from "./items-view";
import { useScanSession } from "./use-scan-session";
import { useScanner } from "./use-scanner";

interface ScanDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenItem: (id: string) => void;
  onShowLocation: (id: string) => void;
  onCreateWithBarcode: (code: string) => void;
}

export function ScanDialog({ open, onClose, onOpenItem, onShowLocation, onCreateWithBarcode }: ScanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan</DialogTitle>
          <DialogDescription>Point the camera at an item, rack or box label — or type / scan a code below.</DialogDescription>
        </DialogHeader>
        {open ? <ScanBody onOpenItem={onOpenItem} onShowLocation={onShowLocation} onCreateWithBarcode={onCreateWithBarcode} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ScanBody({ onOpenItem, onShowLocation, onCreateWithBarcode }: Omit<ScanDialogProps, "open" | "onClose">) {
  const session = useScanSession();
  const scanner = useScanner((code) => void session.resolve(code));
  const [manual, setManual] = useState("");

  useEffect(() => {
    void scanner.start();
  }, [scanner.start]);

  const submitManual = () => {
    void session.resolve(manual);
    setManual("");
  };

  return (
    <div className="space-y-3">
      <div className="bg-muted relative aspect-[4/3] overflow-hidden rounded-lg border">
        <video ref={scanner.videoRef} playsInline muted className="size-full object-cover" />
        {scanner.status === "scanning" ? <ScanLine className="text-primary/70 pointer-events-none absolute inset-0 m-auto size-24" /> : null}
        {scanner.status !== "scanning" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm">
            {scanner.status === "starting" ? <Loader2 className="animate-spin" /> : <CameraOff className="text-muted-foreground" />}
            {scanner.error ? <p className="text-muted-foreground">{scanner.error}</p> : null}
            {scanner.status !== "starting" ? (
              <Button size="sm" variant="outline" onClick={() => void scanner.start()}>
                <Camera /> Start camera
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitManual();
        }}
      >
        <Input placeholder="Type or scan a code…" value={manual} onChange={(e) => setManual(e.target.value)} />
        <Button type="submit" variant="outline" disabled={!manual.trim()}>
          Find
        </Button>
      </form>

      {session.current ? (
        <div className="bg-accent/40 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <MapPin size={14} />
          <span className="min-w-0 flex-1 truncate">
            Put-away location: <strong>{session.current.path}</strong>
          </span>
          <Button size="icon-xs" variant="ghost" aria-label="Clear location" onClick={() => session.setCurrent(null)}>
            <X />
          </Button>
        </div>
      ) : null}
      {session.error ? <p className="text-destructive text-sm">{session.error}</p> : null}

      <ul className="space-y-2">
        {session.results.map((r) => (
          <li key={r.code + r.at} className="space-y-2">
            {r.matches.length === 0 ? (
              <div className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <span className="min-w-0 truncate">
                  No match for <span className="font-mono">{r.code}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => onCreateWithBarcode(r.code)}>
                  <Plus /> Create item
                </Button>
              </div>
            ) : (
              r.matches.map((m) => <MatchCard key={m.id} match={m} code={r.code} session={session} onOpenItem={onOpenItem} onShowLocation={onShowLocation} />)
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatchCard({
  match,
  code,
  session,
  onOpenItem,
  onShowLocation,
}: {
  match: ResolveMatch;
  code: string;
  session: ReturnType<typeof useScanSession>;
  onOpenItem: (id: string) => void;
  onShowLocation: (id: string) => void;
}) {
  if (match.kind === "location") {
    const l = match.location;
    return (
      <div className="flex items-center gap-3 rounded-md border p-3 text-sm">
        <MapPin size={18} className="text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{l.path}</p>
          <p className="text-muted-foreground text-xs">
            {l.totalItems} item{l.totalItems === 1 ? "" : "s"} · {l.kind ?? "location"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => onShowLocation(l.id)}>
          Contents
        </Button>
      </div>
    );
  }
  const item = match.item;
  const canPutAway = session.current && session.current.id !== item.locationId;
  return (
    <div className="flex gap-3 rounded-md border p-3 text-sm">
      <ItemThumb item={item} className="size-14" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <button type="button" className="truncate text-left font-medium hover:underline" onClick={() => onOpenItem(item.id)}>
            {item.title}
          </button>
          <Badge variant={item.lowStock ? "destructive" : "secondary"} className="tabular-nums">
            {formatQuantity(item)}
          </Badge>
        </div>
        <p className="text-muted-foreground truncate text-xs">{item.locationPath ?? "No location"}</p>
        <div className="flex flex-wrap gap-1.5">
          <Button size="icon-xs" variant="outline" aria-label="Remove one" disabled={item.quantity <= 0} onClick={() => session.adjust(item.id, -1, code)}>
            <Minus />
          </Button>
          <Button size="icon-xs" variant="outline" aria-label="Add one" onClick={() => session.adjust(item.id, 1, code)}>
            <Plus />
          </Button>
          {canPutAway ? (
            <Button size="xs" variant="outline" onClick={() => session.putAway(item.id)}>
              Put in {session.current!.title}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
