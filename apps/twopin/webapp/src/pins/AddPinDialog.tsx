import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from "@twodb/blocks";
import type { BoardDto } from "../lib/twopin-client.js";
import { useAddPinDialog } from "./hooks/useAddPinDialog.js";
import { PinPreviewCard } from "./partials/PinPreviewCard.js";

interface AddPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: BoardDto[];
  defaultBoardId: string | undefined;
  onCreatePin: (input: { boardId: string; url: string; note?: string }) => Promise<unknown>;
}

/** Add-pin dialog: paste a URL, watch the metadata preview stream in, pick a board, save. */
export function AddPinDialog(props: AddPinDialogProps) {
  const state = useAddPinDialog(props);
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pin a link</DialogTitle>
          <DialogDescription>Paste a URL — TwoPin fetches its title, description and image.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void state.submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="pin-url">URL</Label>
            <Input
              id="pin-url"
              autoFocus
              value={state.url}
              onChange={(e) => state.setUrl(e.target.value)}
              placeholder="https://example.com/article"
            />
          </div>

          <PinPreviewCard status={state.preview.status} preview={state.preview.preview} error={state.preview.error} />

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
            <Textarea
              id="pin-note"
              value={state.note}
              onChange={(e) => state.setNote(e.target.value)}
              placeholder="Why this link matters…"
              rows={2}
            />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!state.canSubmit}>
              {state.busy ? "Pinning…" : "Pin it"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
