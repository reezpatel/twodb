import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger, Input, Label } from "@twodb/blocks";

/** Dumb/presentational — "Create key" button + the name dialog. */
export function CreateKeyDialog({ busy, onCreate }: { busy: boolean; onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={busy} className="group shrink-0">
          <Plus className="size-3.5 transition-transform duration-200 group-hover:rotate-90" aria-hidden />
          {busy ? "Creating…" : "Create key"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="sr-only">Create API key</DialogTitle>
        <div className="flex flex-col gap-2">
          <Label htmlFor="key-name">Key name</Label>
          <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. twodb-cli on my laptop" />
          <p className="text-[13px] text-ink-muted">
            The raw key (<code className="font-mono">twodb_…</code>) is shown exactly once, right after creation. Only its SHA-256
            hash is stored. Use it as the <code className="font-mono">x-api-key</code> header on gateway calls.
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
