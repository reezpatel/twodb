import { useState } from "react";
import { Box, Plus } from "lucide-react";
import { Button, Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger, Input, Label } from "@twodb/blocks";

/** Dumb/presentational — one space row. */
export function SpaceRow({ space }: { space: { id: string; name: string; createdAt: string | null } }) {
  return (
    <div className="flex items-center gap-3 border-b border-outline px-4 py-3 last:border-b-0">
      <Box className="size-4 shrink-0 text-ink-muted" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <span className="truncate text-[14px] font-medium text-ink">{space.name}</span>
      </div>
      <code className="font-mono text-[11px] text-ink-muted">{space.id}</code>
      {space.createdAt ? (
        <span className="text-[11px] whitespace-nowrap text-ink-muted">
          {new Date(space.createdAt).toLocaleDateString()}
        </span>
      ) : null}
    </div>
  );
}

/** Dumb/presentational — the create-space dialog. */
export function CreateSpaceDialog({ busy, onCreate }: { busy: boolean; onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" aria-hidden />
          Create space
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
            {busy ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
