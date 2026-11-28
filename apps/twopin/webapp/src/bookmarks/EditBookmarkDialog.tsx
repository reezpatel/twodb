import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import { useEffect, useState } from "react";
import type { BookmarkDto, BookmarkFolderDto } from "../lib/twopin-client.js";

interface EditBookmarkDialogProps {
  bookmark: BookmarkDto | null;
  folders: BookmarkFolderDto[];
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: { folderId?: string | null; url?: string; title?: string | null; description?: string | null }) => Promise<unknown>;
}

/** Edit-bookmark dialog: change title, url, or move folders. */
export function EditBookmarkDialog({ bookmark, folders, onOpenChange, onSave }: EditBookmarkDialogProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bookmark) {
      setTitle(bookmark.title ?? "");
      setUrl(bookmark.url);
      setFolderId(bookmark.folderId ?? "");
      setError(null);
    }
  }, [bookmark]);

  const save = async () => {
    if (!bookmark || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(bookmark.id, {
        folderId: folderId || null,
        title: title.trim() || null,
        url: url.trim() !== bookmark.url ? url.trim() : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={bookmark !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit bookmark</DialogTitle>
          <DialogDescription className="truncate">{bookmark?.url}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="edit-bm-title">Title</Label>
            <Input id="edit-bm-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-bm-url">URL</Label>
            <Input id="edit-bm-url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-bm-folder">Folder</Label>
            <select id="edit-bm-folder" className="h-9 rounded-md border border-outline bg-paper px-3 text-sm text-ink" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
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
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

