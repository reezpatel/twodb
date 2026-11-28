import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import { useEffect, useState } from "react";
import type { BookmarkFolderDto } from "../lib/twopin-client.js";

interface AddBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: BookmarkFolderDto[];
  defaultFolderId: string | null;
  onCreate: (input: { folderId?: string | null; url: string }) => Promise<unknown>;
}

/** Add-bookmark dialog: paste a URL, pick a folder. Metadata is fetched server-side. */
export function AddBookmarkDialog({ open, onOpenChange, folders, defaultFolderId, onCreate }: AddBookmarkDialogProps) {
  const [url, setUrl] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl("");
      setError(null);
      setFolderId(defaultFolderId ?? "");
    }
  }, [open, defaultFolderId]);

  const submit = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ url: url.trim(), folderId: folderId || null });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add bookmark</DialogTitle>
          <DialogDescription>Paste a URL — TwoPin fetches its title and favicon.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="bm-url">URL</Label>
            <Input id="bm-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bm-folder">Folder</Label>
            <select id="bm-folder" className="h-9 rounded-md border border-outline bg-paper px-3 text-sm text-ink" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">Unfiled</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim() || busy}>
              {busy ? "Saving…" : "Save bookmark"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

