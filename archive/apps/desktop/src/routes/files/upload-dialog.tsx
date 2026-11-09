import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Paperclip, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface UploadEntry {
  id: string;
  name: string;
  size: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
}

export function UploadDialog({
  open,
  onClose,
  target,
  backend,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  backend: string;
  target: string;
  onUpload: (dir: string, files: File[]) => Promise<unknown>;
}) {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setEntries([]);
  }, [open]);

  const run = async (list: File[]) => {
    if (list.length === 0) return;
    setEntries((cur) => [...cur, ...list.map((f, i) => ({ id: `${Date.now()}-${i}`, name: f.name, size: f.size, status: "uploading" as const }))]);
    try {
      await onUpload(target, list);
      setEntries((cur) => cur.map((e) => ({ ...e, status: "complete" })));
    } catch (err) {
      setEntries((cur) => cur.map((e) => ({ ...e, status: "error", error: (err as Error).message })));
    }
  };

  const busy = entries.some((e) => e.status === "uploading" || e.status === "pending");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            to{" "}
            <code className="font-mono">
              {backend}
              {target ? `/${target}` : ""}
            </code>
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "border-border flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors",
            dragging && "border-ring bg-accent",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void run(Array.from(e.dataTransfer.files));
          }}
        >
          <Upload size={22} className="text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm">Drag files here</p>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Paperclip size={13} /> Browse
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              void run(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        {entries.length > 0 && (
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2">
                {entry.status === "uploading" && <Loader2 size={13} className="animate-spin" />}
                {entry.status === "complete" && <Check size={13} className="text-success" />}
                {entry.status === "error" && <X size={13} className="text-destructive" />}
                <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                <span className={cn("text-xs", entry.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                  {entry.status === "error" ? entry.error : formatFileSize(entry.size)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
