import { useState } from "react";
import { Folder } from "lucide-react";
import { NOTE_GROUP_TYPES, type NoteGroupType } from "../use-notes-scene";
import { TYPE_META, type NotesHook } from "./section-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CreatePanel({
  sectionId,
  parentId,
  parentName,
  notes,
  onClose,
}: {
  sectionId: string;
  parentId: string | null;
  parentName: string;
  notes: NotesHook;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [choice, setChoice] = useState<"folder" | NoteGroupType>(parentId ? "notes" : "folder");

  const options: { value: "folder" | NoteGroupType; label: string; icon: typeof Folder }[] = parentId
    ? [{ value: "folder", label: "Folder", icon: Folder }, ...NOTE_GROUP_TYPES.map((t) => ({ value: t, label: TYPE_META[t].label, icon: TYPE_META[t].icon }))]
    : [{ value: "folder", label: "Folder", icon: Folder }];

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (choice === "folder") notes.createFolder.mutate({ sectionId, parentId, name: trimmed });
    else notes.createGroup.mutate({ folderId: parentId!, type: choice, name: trimmed });
    onClose();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 pt-8">
        <div>
          <h2 className="text-base font-semibold">New in “{parentName}”</h2>
          <p className="text-muted-foreground/70 text-xs">Pick a type, name it, create.</p>
        </div>
        <Input
          autoFocus
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="grid grid-cols-3 gap-2">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => setChoice(o.value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors hover:bg-accent",
                choice === o.value ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              <o.icon size={18} className="text-muted-foreground" aria-hidden="true" />
              <span className="text-xs font-medium">{o.label}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}
