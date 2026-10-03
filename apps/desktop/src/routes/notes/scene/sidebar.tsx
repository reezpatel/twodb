import { useMemo, useState } from "react";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { NoteFolder as NoteFolderT } from "../use-notes-scene";
import { MenuTrigger, PlusTrigger, SectionTree, type NotesHook, type TreeNodeData } from "./section-tree";
import { FavoriteRow } from "./favorites-row";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Sidebar({
  notes,
  scrollRoot,
  onCreate,
}: {
  notes: NotesHook;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  onCreate: (sectionId: string, parentId: string | null, parentName: string) => void;
}) {
  const data = notes.tree.data;
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [sectionRename, setSectionRename] = useState<{ id: string; value: string } | null>(null);

  const groupsByFolder = useMemo(() => {
    const map = new Map<string, TreeNodeData[]>();
    for (const g of data?.groups ?? []) {
      const bucket = map.get(g.folderId) ?? [];
      bucket.push({ id: g.id, name: g.name, kind: "group", type: g.type, isFavorite: g.isFavorite });
      map.set(g.folderId, bucket);
    }
    return map;
  }, [data]);

  const childFoldersOf = (parentId: string) =>
    (data?.folders ?? []).filter((f) => f.parentId === parentId).sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));

  const folderToNode = (folder: NoteFolderT): TreeNodeData => ({
    id: folder.id,
    name: folder.name,
    kind: "folder",
    children: [...(groupsByFolder.get(folder.id) ?? []), ...childFoldersOf(folder.id).map(folderToNode)],
  });

  const sectionNodes = useMemo(() => {
    const map = new Map<string, TreeNodeData[]>();
    for (const section of data?.sections ?? []) {
      map.set(
        section.id,
        (data?.folders ?? [])
          .filter((f) => f.sectionId === section.id && f.parentId === null)
          .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
          .map(folderToNode),
      );
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const favorites = useMemo(() => {
    const all: TreeNodeData[] = [];
    for (const bucket of groupsByFolder.values()) all.push(...bucket);
    return all.filter((g) => g.isFavorite);
  }, [groupsByFolder]);

  const toggleSection = (id: string) =>
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commitSectionRename = () => {
    if (!sectionRename) return;
    const value = sectionRename.value.trim();
    if (value) notes.renameSection.mutate({ id: sectionRename.id, name: value });
    setSectionRename(null);
  };

  return (
    <aside className="bg-card border-r flex h-full w-72 shrink-0 flex-col border-r">
      <div className="border-b flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Notes</span>
        <Button
          variant="ghost"
          size="icon-sm"
          title="New section"
          onClick={() => notes.createSection.mutate(undefined)}
          disabled={notes.createSection.isPending}
        >
          <Plus />
        </Button>
      </div>
      <div ref={scrollRoot} className="min-h-0 flex-1 overflow-y-auto py-1">
        {favorites.length > 0 && (
          <div className="mb-2">
            <div className="text-muted-foreground/70 px-3 pb-1 pt-2 text-[11px] font-semibold tracking-wide uppercase">Favorites</div>
            {favorites.map((g) => (
              <FavoriteRow key={g.id} group={g} notes={notes} isSelected={notes.selectedGroupId === g.id} />
            ))}
          </div>
        )}

        {(data?.sections ?? []).map((section) => {
          const isCollapsed = collapsedSections.has(section.id);
          const isRenaming = sectionRename?.id === section.id;
          const hasContent = (sectionNodes.get(section.id) ?? []).length > 0;
          return (
            <div key={section.id} className="mb-1">
              <div className="group flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-1.5 hover:bg-accent" onClick={() => toggleSection(section.id)}>
                <ChevronRight
                  size={13}
                  className={cn("text-muted-foreground shrink-0 transition-transform", !isCollapsed && "rotate-90", !hasContent && "invisible")}
                  aria-hidden="true"
                />
                {isRenaming && sectionRename ? (
                  <Input
                    autoFocus
                    className="h-6 px-1 text-sm"
                    value={sectionRename.value}
                    onChange={(e) => setSectionRename({ id: section.id, value: e.target.value })}
                    onBlur={commitSectionRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitSectionRename();
                      if (e.key === "Escape") setSectionRename(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{section.name}</span>
                )}
                <PlusTrigger
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreate(section.id, null, section.name);
                  }}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <MenuTrigger />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => setSectionRename({ id: section.id, value: section.name })}>
                      <Pencil size={13} /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        if (window.confirm(`Delete section "${section.name}" and everything inside it? This cannot be undone.`))
                          notes.deleteSection.mutate(section.id);
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {!isCollapsed && (
                <SectionTree
                  nodes={sectionNodes.get(section.id) ?? []}
                  notes={notes}
                  selectedGroupId={notes.selectedGroupId}
                  scrollRoot={scrollRoot}
                  onCreate={(parentId, parentName) => onCreate(section.id, parentId, parentName)}
                />
              )}
            </div>
          );
        })}

        {notes.tree.isSuccess && (data?.sections ?? []).length === 0 && (
          <p className="text-muted-foreground p-3 text-sm">
            No sections yet — hit <span className="font-semibold">+</span> to create your first one.
          </p>
        )}
        {notes.tree.isPending && <p className="text-muted-foreground p-3 text-sm">Loading…</p>}
      </div>
    </aside>
  );
}
