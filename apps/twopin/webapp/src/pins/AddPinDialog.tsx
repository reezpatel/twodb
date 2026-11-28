import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from "@twodb/blocks";
import { Image as ImageIcon, Link2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import type { BoardDto } from "../lib/twopin-client.js";
import { twopinClient } from "../lib/twopin-client.js";
import { useAddPinDialog, type CreatePinInput } from "./hooks/useAddPinDialog.js";
import { PinPreviewCard } from "./partials/PinPreviewCard.js";
import { TagInput } from "./partials/TagInput.js";

interface AddPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: BoardDto[];
  defaultBoardId: string | undefined;
  onCreatePin: (input: CreatePinInput) => Promise<unknown>;
}

/** Add-pin dialog: pin a link (metadata fetched) or upload an image/video directly. */
export function AddPinDialog(props: AddPinDialogProps) {
  const state = useAddPinDialog(props);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (props.open) {
      void twopinClient.listTags().then((ts) => setSuggestions(ts.map((t) => t.tag))).catch(() => {});
    }
  }, [props.open]);
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add pin</DialogTitle>
          <DialogDescription>Pin a link, or upload an image / video directly.</DialogDescription>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-1 rounded-lg bg-stone p-1">
          <TabButton active={state.mode === "link"} onClick={() => state.setMode("link")} icon={Link2}>
            Link
          </TabButton>
          <TabButton active={state.mode === "upload"} onClick={() => state.setMode("upload")} icon={Upload}>
            Upload
          </TabButton>
        </div>

        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void state.submit();
          }}
        >
          {state.mode === "link" ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="pin-url">URL</Label>
                <Input id="pin-url" autoFocus value={state.url} onChange={(e) => state.setUrl(e.target.value)} placeholder="https://example.com/article" />
              </div>
              <PinPreviewCard status={state.preview.status} preview={state.preview.preview} error={state.preview.error} />
            </>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label>Media (image or video)</Label>
                <button
                  type="button"
                  onClick={() => state.fileRef.current?.click()}
                  className="flex h-28 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-outline text-ink-muted transition-colors hover:border-ion-deep hover:text-ink"
                >
                  {state.file ? (
                    <>
                      <ImageIcon className="size-6" />
                      <span className="max-w-full truncate px-2 text-xs">{state.file.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-6" />
                      <span className="text-xs">Click to choose an image or video</span>
                    </>
                  )}
                </button>
                <input
                  ref={state.fileRef}
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={(e) => state.setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pin-title">Title (optional)</Label>
                <Input id="pin-title" value={state.title} onChange={(e) => state.setTitle(e.target.value)} placeholder="Caption for this media" />
              </div>
            </>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="pin-board">Board</Label>
            <select
              id="pin-board"
              className="h-9 rounded-md border border-outline bg-paper px-3 text-sm text-ink"
              value={state.boardId}
              onChange={(e) => state.setBoardId(e.target.value)}
            >
              {props.boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pin-note">Note (optional)</Label>
            <Textarea id="pin-note" value={state.note} onChange={(e) => state.setNote(e.target.value)} placeholder="Why this matters…" rows={2} />
          </div>

          <div className="grid gap-1.5">
            <Label>Tags</Label>
            <TagInput tags={state.tags} onChange={state.setTags} suggestions={suggestions} />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!state.canSubmit}>
              {state.busy ? "Saving…" : state.mode === "link" ? "Pin it" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Link2; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-paper text-ink shadow-sm" : "text-ink-muted hover:text-ink"
      }`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}

