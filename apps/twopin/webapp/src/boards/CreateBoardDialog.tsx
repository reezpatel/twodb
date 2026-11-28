import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from "@twodb/blocks";
import { useEffect, useState } from "react";
import { useTwoPin } from "../state/TwoPinProvider.js";

/** Dialog for creating a board — opened from the Boards heading's + button. */
export function CreateBoardDialog() {
  const tp = useTwoPin();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tp.createBoardOpen) {
      setName("");
      setDescription("");
      setError(null);
    }
  }, [tp.createBoardOpen]);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await tp.createBoard(name.trim(), description.trim() || undefined);
      tp.setCreateBoardOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={tp.createBoardOpen} onOpenChange={tp.setCreateBoardOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New board</DialogTitle>
          <DialogDescription>Boards are visual collections of pinned links.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="board-name">Name</Label>
            <Input id="board-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Design inspiration" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="board-desc">Description (optional)</Label>
            <Textarea id="board-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => tp.setCreateBoardOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || busy}>
              {busy ? "Creating…" : "Create board"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

