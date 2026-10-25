import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Database, Pencil, Plus, Trash2, Unlink } from "lucide-react";
import type { NotesHook, TreeNode } from "../use-notes-scene";
import { MenuTrigger, PlusTrigger, SectionTree, type TreeItem } from "./section-tree";
import { FlatNodeRow } from "./favorites-row";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SideNav } from "@/components/side-nav";
import { cn } from "@/lib/utils";

function SidebarHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-muted-foreground/70 px-3 pb-1 pt-2 text-[11px] font-semibold tracking-wide uppercase", className)}>{children}</div>;
}

export function Sidebar({ notes, scrollRoot }: { notes: NotesHook; scrollRoot: React.RefObject<HTMLDivElement | null> }) {
  const navigate = useNavigate();
  const all = useMemo(() => notes.tree.data?.nodes ?? [], [notes.tree.data]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [sectionRename, setSectionRename] = useState<{ id: string; value: string } | null>(null);

  const { sections, treeBySection, favorites, dangling } = useMemo(() => {
    const childrenOf = new Map<string, TreeNode[]>();
    for (const n of all) {
      // rows (starred only) and dangling databases live in their own lists
      if (n.kind === "section" || n.isRow || n.dangling || !n.parentId) continue;
      const bucket = childrenOf.get(n.parentId) ?? [];
      bucket.push(n);
      childrenOf.set(n.parentId, bucket);
    }
    const build = (parentId: string): TreeItem[] =>
      (childrenOf.get(parentId) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((n) => ({
          id: n.id,
          title: n.title,
          kind: n.kind as TreeItem["kind"],
          icon: n.icon,
          isFavorite: n.isFavorite,
          ...(n.kind === "page" ? { children: build(n.id) } : {}),
        }));
    const sections = all.filter((n) => n.kind === "section").sort((a, b) => a.position - b.position);
    return {
      sections,
      treeBySection: new Map(sections.map((s) => [s.id, build(s.id)])),
      favorites: all.filter((n) => n.isFavorite && n.kind !== "section"),
      dangling: all.filter((n) => n.dangling),
    };
  }, [all]);

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
    if (value) notes.updateNode.mutate({ id: sectionRename.id, title: value });
    setSectionRename(null);
  };

  return (
    <SideNav className="gap-0 overflow-hidden p-0">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Notes</span>
        <Button variant="ghost" size="icon-sm" title="New section" onClick={() => notes.createSection.mutate(undefined)} disabled={notes.createSection.isPending}>
          <Plus />
        </Button>
      </div>

      <div ref={scrollRoot} className="min-h-0 flex-1 overflow-y-auto py-1">
        {favorites.length > 0 && (
          <div className="mb-2">
            <SidebarHeading>Favorites</SidebarHeading>
            {favorites.map((n) => (
              <FlatNodeRow key={n.id} node={n} notes={notes} showStar />
            ))}
          </div>
        )}

        {sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.id);
          const items = treeBySection.get(section.id) ?? [];
          return (
            <div key={section.id} className="mb-1">
              <div className="group flex h-7 cursor-pointer items-center gap-1.5 px-1.5 hover:bg-accent" onClick={() => toggleSection(section.id)}>
                <ChevronRight
                  size={13}
                  className={cn("text-muted-foreground shrink-0 transition-transform", !isCollapsed && "rotate-90", items.length === 0 && "invisible")}
                  aria-hidden="true"
                />
                {sectionRename?.id === section.id ? (
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
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs font-semibold">{section.title}</span>
                )}
                <PlusTrigger
                  title="Add a page"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsedSections((prev) => {
                      const next = new Set(prev);
                      next.delete(section.id);
                      return next;
                    });
                    notes.createNode.mutate({ parentId: section.id });
                  }}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <MenuTrigger />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => setSectionRename({ id: section.id, value: section.title })}>
                      <Pencil size={13} /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        if (window.confirm(`Delete section "${section.title}"? Its pages move to trash; databases inside become dangling.`))
                          notes.deleteNode.mutate(section.id);
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {!isCollapsed && <SectionTree sectionId={section.id} nodes={items} notes={notes} scrollRoot={scrollRoot} />}
              {!isCollapsed && items.length === 0 && (
                <button
                  className="text-muted-foreground/60 hover:bg-accent hover:text-foreground flex h-[26px] w-full items-center gap-1.5 pl-6 text-left text-[13px]"
                  onClick={() => notes.createNode.mutate({ parentId: section.id })}
                >
                  <Plus size={13} /> Add a page
                </button>
              )}
            </div>
          );
        })}

        {notes.tree.isSuccess && sections.length === 0 && (
          <p className="text-muted-foreground p-3 text-sm">
            No sections yet — hit <span className="font-semibold">+</span> to create your first one.
          </p>
        )}
        {notes.tree.isPending && <p className="text-muted-foreground p-3 text-sm">Loading…</p>}
      </div>

      {/* bottom: databases that lost their home + the databases browser */}
      <div className="shrink-0 border-t py-1">
        {dangling.length > 0 && (
          <div className="max-h-40 overflow-y-auto pb-1">
            <SidebarHeading className="flex items-center gap-1">
              <Unlink size={11} /> Dangling
            </SidebarHeading>
            {dangling.map((n) => (
              <FlatNodeRow key={n.id} node={n} notes={notes} />
            ))}
          </div>
        )}
        <button
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-7 w-full items-center gap-1.5 px-2 text-left text-[13px]"
          onClick={() => navigate("/apps/notes/databases")}
        >
          <Database size={14} /> All databases
        </button>
      </div>
    </SideNav>
  );
}
