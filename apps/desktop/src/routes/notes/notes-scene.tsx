import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { NotebookPen, Star } from "lucide-react";
import { useNotesScene, type NoteFolder, type NoteGroup } from "./use-notes-scene";
import { Sidebar } from "./scene/sidebar";
import { CreatePanel } from "./scene/create-panel";
import { NotesView } from "./view/notes-view";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function NotesScene() {
  const navigate = useNavigate();
  const { groupId: groupIdParam, noteId: noteIdParam } = useParams();
  const groupFromUrl = groupIdParam ?? null;
  const noteFromUrl = noteIdParam ?? null;

  const setSelectedGroupId = useCallback(
    (id: string | null) => {
      navigate(id ? `/apps/notes/${id}` : "/apps/notes", { replace: true });
    },
    [navigate],
  );

  const setOpenNoteId = useCallback(
    (id: string | null) => {
      if (!groupFromUrl) return;
      navigate(id ? `/apps/notes/${groupFromUrl}/${id}` : `/apps/notes/${groupFromUrl}`, { replace: true });
    },
    [navigate, groupFromUrl],
  );

  const notes = useNotesScene({ selectedGroupId: groupFromUrl, onSelectGroupId: setSelectedGroupId });
  const data = notes.tree.data;
  const scrollRoot = useRef<HTMLDivElement>(null);
  const [createView, setCreateView] = useState<{ sectionId: string; parentId: string | null; parentName: string } | null>(null);

  const selectedGroup = (data?.groups ?? []).find((g) => g.id === notes.selectedGroupId) ?? null;

  return (
    <div className="flex h-full">
      <Sidebar notes={notes} scrollRoot={scrollRoot} onCreate={(sectionId, parentId, parentName) => setCreateView({ sectionId, parentId, parentName })} />
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {createView ? (
          <CreatePanel
            sectionId={createView.sectionId}
            parentId={createView.parentId}
            parentName={createView.parentName}
            notes={notes}
            onClose={() => setCreateView(null)}
          />
        ) : selectedGroup ? (
          <SelectedGroupPane group={selectedGroup} notes={notes} openNoteId={noteFromUrl} setOpenNoteId={setOpenNoteId} />
        ) : (
          <EmptyState />
        )}
      </div>
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
  notes: ReturnType<typeof useNotesScene>;
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
