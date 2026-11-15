import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import type { BoardGroup } from "@shared/model";
import type { Space } from "../../lib/paintress-client";

const NEW_GROUP = "__new__";

export function NewBoardDialog(props: {
  open: boolean;
  /** Kind the dialog starts on (the sidebar tab it was opened from). */
  initialKind: "diagram" | "doc";
  groups: BoardGroup[];
  spaces: Space[];
  onClose(): void;
  onCreate(input: { name: string; kind: "diagram" | "doc"; groupId?: string; groupName?: string; spaceId?: string }): Promise<void>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"diagram" | "doc">("diagram");
  const [groupId, setGroupId] = useState<string>(NEW_GROUP);
  const [groupName, setGroupName] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.open) {
      setKind(props.initialKind);
      setName("");
      setGroupId(props.groups[0]?.id ?? NEW_GROUP);
      setGroupName("");
      setSpaceId(props.spaces[0]?.id ?? "");
      setError(null);
    }
  }, [props.open, props.initialKind]); // eslint-disable-line react-hooks/exhaustive-deps

  const isNewGroup = groupId === NEW_GROUP;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await props.onCreate({
        name: name.trim(),
        kind,
        ...(isNewGroup ? { groupName: groupName.trim() || "General", spaceId: spaceId || undefined } : { groupId }),
      });
      setName("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const choice = (k: "diagram" | "doc", title: string, hint: string) => (
    <button
      type="button"
      onClick={() => setKind(k)}
      className={`flex-1 rounded-md border p-3 text-left ${kind === k ? "border-ion-deep bg-paper-grid" : "border-outline bg-paper"}`}
    >
      <div className="font-semibold text-ink">{title}</div>
      <div className="text-xs text-ink-muted">{hint}</div>
    </button>
  );
  const selectCls = "h-9 rounded-md border border-outline bg-paper px-3 text-ink";

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New board</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            {choice("diagram", "Diagram", "Architecture, AWS/GCP, ERD, flowchart, process map")}
            {choice("doc", "Markdown doc", "Markdown with Mermaid diagrams")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="board-name">Name</Label>
            <Input id="board-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && void submit()} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="board-group">Group</Label>
            <select id="board-group" value={groupId} onChange={(e) => setGroupId(e.target.value)} className={selectCls}>
              {props.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value={NEW_GROUP}>+ New group…</option>
            </select>
          </div>
          {isNewGroup && (
            <div className="flex gap-3 rounded-md border border-dashed border-outline p-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="group-name">New group name</Label>
                <Input id="group-name" value={groupName} placeholder="General" onChange={(e) => setGroupName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && void submit()} />
              </div>
              {props.spaces.length > 0 && (
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="group-space">Space</Label>
                  <select id="group-space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={selectCls}>
                    {props.spaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || busy} onClick={() => void submit()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
