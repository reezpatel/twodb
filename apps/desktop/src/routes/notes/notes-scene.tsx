import { useMemo } from "react";
import { NotebookPen, Star } from "lucide-react";
import { useNotes, type NoteFolder, type NoteGroup } from "./notes-provider";
import { CreatePanel } from "./scene/create-panel";
import { NotesView } from "./view/notes-view";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function NotesScene() {
  const { notes, createView, closeCreate, noteFromUrl, setOpenNoteId } = useNotes();
  const data = notes.tree.data;
  const selectedGroup = (data?.groups ?? []).find((g) => g.id === notes.selectedGroupId) ?? null;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {createView ? (
        <CreatePanel sectionId={createView.sectionId} parentId={createView.parentId} parentName={createView.parentName} notes={notes} onClose={closeCreate} />
      ) : selectedGroup ? (
        <SelectedGroupPane group={selectedGroup} notes={notes} openNoteId={noteFromUrl} setOpenNoteId={setOpenNoteId} />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function SelectedGroupPane({
  group,
  notes,
  openNoteId,
  setOpenNoteId,
}: {
  group: NoteGroup;
  notes: ReturnType<typeof useNotes>["notes"];
  openNoteId: string | null;
  setOpenNoteId: (id: string | null) => void;
}) {
  const data = notes.tree.data;
  const foldersById = useMemo(() => new Map((data?.folders ?? []).map((f) => [f.id, f])), [data]);
  return (
    <>
      <div className="border-b flex items-center gap-2 border-b px-4 py-2.5">
        <span className="text-sm font-semibold">{group.name}</span>
        <Badge variant="secondary">{group.type[0].toUpperCase() + group.type.slice(1)}</Badge>
        <button
          className={cn("ml-1 text-xs leading-none", group.isFavorite ? "text-warning" : "text-muted-foreground/70 hover:text-foreground")}
          title={group.isFavorite ? "Remove from favorites" : "Add to favorites"}
          onClick={() => notes.toggleFavorite.mutate({ id: group.id, isFavorite: !group.isFavorite })}
        >
          <Star size={13} fill={group.isFavorite ? "currentColor" : "none"} />
        </button>
        <span className="text-muted-foreground/60 ml-auto truncate text-xs">{folderPath(foldersById, group.folderId)}</span>
      </div>
      <NotesView key={group.id} groupId={group.id} openNoteId={openNoteId} setOpenNoteId={setOpenNoteId} />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <NotebookPen size={28} className="text-muted-foreground/50" aria-hidden="true" />
        <p className="text-muted-foreground text-sm font-medium">Notes</p>
        <p className="text-muted-foreground/70 max-w-xs text-center text-xs">
          Pick a note-group from a folder to open it. Star groups you use often — they pin to the top.
        </p>
      </div>
    </div>
  );
}

function folderPath(foldersById: Map<string, NoteFolder>, folderId: string) {
  const parts: string[] = [];
  let current: string | null = folderId;
  while (current) {
    const folder = foldersById.get(current);
    if (!folder) break;
    parts.unshift(folder.name);
    current = folder.parentId;
  }
  return parts.join(" / ");
}
