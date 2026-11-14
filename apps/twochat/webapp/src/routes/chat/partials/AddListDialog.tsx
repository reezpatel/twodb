import { useEffect, useState } from "react";
import { Button, Input, Label } from "@twodb/blocks";
import { X } from "lucide-react";
import type { Space } from "../../../lib/chat-client";
import { SpacePicker } from "./SpacePicker";

/** Creates an isolated top-level conversation list, optionally space-scoped. */
export function AddListDialog(props: {
  open: boolean;
  spaces: Space[];
  error?: string | null;
  onCreate: (name: string, spaceId?: string | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState("");

  useEffect(() => {
    if (!props.open) return;
    setName("");
    setSpaceId("");
  }, [props.open]);

  if (!props.open) return null;
  const selectedSpace = props.spaces.find((space) => space.id === spaceId);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={props.onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">New conversation list</span>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={props.onClose}><X size={14} /></Button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="list-name">Name</Label>
            <Input id="list-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Customers, Personal, External…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="list-space">Scope</Label>
            <SpacePicker id="list-space" spaces={props.spaces} value={spaceId} onChange={setSpaceId} />
            <span className="text-[11px] text-muted-foreground">
              {selectedSpace
                ? `Only members with access to ${selectedSpace.name} can see this list.`
                : "Workspace lists are visible across all Spaces."}
            </span>
          </div>
          {!props.spaces.length ? (
            <p className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground">
              No Spaces are available yet. Create one in TwoDB → Spaces, or keep this list workspace-wide.
            </p>
          ) : null}
          {props.error ? <p className="text-xs text-red-500">{props.error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={props.onClose}>Cancel</Button>
            <Button size="sm" disabled={!name.trim()} onClick={() => props.onCreate(name.trim(), spaceId || null)}>Create list</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
