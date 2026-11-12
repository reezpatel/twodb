import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger, Input, Label } from "@twodb/blocks";

/** Dumb/presentational — "Create space" button + the name dialog. */
export function CreateSpaceDialog({ busy, onCreate }: { busy: boolean; onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={busy} className="group shrink-0">
          <Plus className="size-3.5 transition-transform duration-200 group-hover:rotate-90" aria-hidden />
          {busy ? "Creating…" : "Create space"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="sr-only">Create space</DialogTitle>
        <div className="flex flex-col gap-2">
          <Label htmlFor="space-name">Space name</Label>
          <Input id="space-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. personal" />
          <p className="text-[13px] text-ink-muted">
            Spaces are the workspace's sub-scopes — apps link resources (like TwoRoute connections) to one or more of
            them to control who can see what.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || busy}
            onClick={() => {
              onCreate(name.trim());
              setName("");
              setOpen(false);
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
