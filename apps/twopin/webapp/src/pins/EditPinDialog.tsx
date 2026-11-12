import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from "@twodb/blocks";
import type { BoardDto, PinDto } from "../lib/twopin-client.js";
import { useEditPinDialog } from "./hooks/useEditPinDialog.js";

interface EditPinDialogProps {
  pin: PinDto | null;
  boards: BoardDto[];
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: { boardId?: string; title?: string | null; description?: string | null; note?: string | null }) => Promise<unknown>;
}

/** Edit-pin dialog: override title/description, edit note, or move boards. */
export function EditPinDialog(props: EditPinDialogProps) {
  const state = useEditPinDialog({ pin: props.pin, onOpenChange: props.onOpenChange, onSave: props.onSave });
  return (
    <Dialog open={props.pin !== null} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit pin</DialogTitle>
          <DialogDescription className="truncate">{props.pin?.url}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void state.save();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="edit-pin-title">Title</Label>
            <Input id="edit-pin-title" value={state.title} onChange={(e) => state.setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-pin-description">Description</Label>
            <Textarea id="edit-pin-description" value={state.description} onChange={(e) => state.setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-pin-note">Note</Label>
            <Textarea id="edit-pin-note" value={state.note} onChange={(e) => state.setNote(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-pin-board">Board</Label>
            <select
              id="edit-pin-board"
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

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={state.busy}>
              {state.busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
