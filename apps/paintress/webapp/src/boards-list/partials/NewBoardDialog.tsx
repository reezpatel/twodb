import { useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import type { Space } from "../../lib/paintress-client";

export function NewBoardDialog(props: {
  open: boolean;
  spaces: Space[];
  onClose(): void;
  onCreate(input: { name: string; kind: "diagram" | "doc"; spaceId?: string }): Promise<void>;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"diagram" | "doc">("diagram");
  const [spaceId, setSpaceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await props.onCreate({ name: name.trim(), kind, spaceId: spaceId || undefined });
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
          {props.spaces.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="board-space">Space</Label>
              <select id="board-space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className="h-9 rounded-md border border-outline bg-paper px-3 text-ink">
                <option value="">Default</option>
                {props.spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
