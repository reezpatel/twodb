import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Database, ImageIcon, Loader2, MoreHorizontal, NotebookPen, Pencil, RotateCcw, Share2, Smile, Star, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useNotes } from "./notes-provider";
import { assetPreviewUrl, uploadNodeAsset, useNode, type NodeDetail, type NotesHook, type TreeNode } from "./use-notes-scene";
import { NotesView } from "./view/notes-view";
import { useNotesView } from "./view/use-notes-view";
import { NoteEditor } from "./editor/note-editor";
import { rowPage, useRowSaver } from "./editor/row-saver";
import type { EditablePage, PageSaver } from "./editor/use-note-editor";
import { NodeIcon } from "./scene/section-tree";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** /apps/notes/:nodeId — renders whatever the node is: page or database. */
export function NotesScene() {
  const { notes, nodeFromUrl, rowFromUrl, setOpenNoteId } = useNotes();
  const node = useNode(nodeFromUrl);

  if (!nodeFromUrl) return <EmptyState />;
  if (node.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground animate-spin" size={18} />
      </div>
    );
  }
  if (!node.data || node.data.kind === "section") return <EmptyState notFound={!node.data} />;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {node.data.kind === "database" ? (
        <DatabaseScene key={node.data.id} node={node.data} notes={notes} openNoteId={rowFromUrl} setOpenNoteId={setOpenNoteId} />
      ) : (
        <PageScene key={node.data.id} node={node.data} notes={notes} />
      )}
    </div>
  );
}

/** Breadcrumb segments incl. the node itself: first two + last two, "…" between. */
function collapsePath<T>(all: T[], ellipsis: T): T[] {
  if (all.length <= 4) return all;
  return [all[0], all[1], ellipsis, all[all.length - 2], all[all.length - 1]];
}

/** Fixed top bar: breadcrumb (ancestors → node) + share/favorite/menu. */
function NodeHeaderBar({ node, notes, onRename }: { node: NodeDetail; notes: NotesHook; onRename?: () => void }) {
  const navigate = useNavigate();
  const chain = [...node.ancestors, { id: node.id, kind: node.kind, title: node.title, icon: node.icon }];
  const crumbs = collapsePath<(typeof chain)[number] | null>(chain, null);
  const fullTitle = chain.map((c) => c.title || "Untitled").join(" / ");
  const deleted = Boolean(node.deletedAt);

  return (
    <div className="bg-background z-30 shrink-0">
      <div className="flex h-9 items-center gap-2 px-4">
        <span className="text-muted-foreground/60 flex min-w-0 flex-1 items-center gap-1 truncate text-sm" title={fullTitle}>
          {crumbs.map((c, i) => (
            <span key={c?.id ?? `gap-${i}`} className={cn("flex min-w-0 items-center gap-1", i === crumbs.length - 1 && "text-foreground/80 font-medium")}>
              {i > 0 && <ChevronRight size={11} className="text-muted-foreground/40 shrink-0" aria-hidden="true" />}
              {c === null ? (
                <span>…</span>
              ) : c.kind === "section" ? (
                <span className="truncate">{c.title}</span>
              ) : (
                <button className="hover:text-foreground flex min-w-0 items-center gap-1" onClick={() => navigate(`/apps/notes/${c.id}`)}>
                  <NodeIcon kind={c.kind} icon={c.icon} size={13} />
                  <span className="truncate">{c.title || "Untitled"}</span>
                </button>
              )}
            </span>
          ))}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2 text-xs" disabled title="Share (coming soon)">
            <Share2 size={13} /> Share
          </Button>
          <button
            className={cn("px-1.5 text-xs leading-none", node.isFavorite ? "text-warning" : "text-muted-foreground/70 hover:text-foreground")}
            title={node.isFavorite ? "Remove from favorites" : "Add to favorites"}
            onClick={() => notes.toggleFavorite.mutate({ id: node.id, isFavorite: !node.isFavorite })}
          >
            <Star size={14} fill={node.isFavorite ? "currentColor" : "none"} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground/70 hover:text-foreground px-1.5 leading-none" title="More">
                <MoreHorizontal size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onRename && (
                <DropdownMenuItem onSelect={onRename}>
                  <Pencil size={13} /> Rename
                </DropdownMenuItem>
              )}
              {deleted ? (
                <DropdownMenuItem onSelect={() => notes.restoreNode.mutate(node.id)}>
                  <RotateCcw size={13} /> Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    const what = node.kind === "database" ? "This database moves to trash (restore it from All databases)." : "This page and its sub-pages move to trash.";
                    if (window.confirm(`Delete "${node.title || "Untitled"}"? ${what}`)) {
                      notes.deleteNode.mutate(node.id);
                      navigate("/apps/notes");
                    }
                  }}
                >
                  <Trash2 size={13} /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {deleted && (
        <div className="bg-destructive/10 text-destructive flex items-center justify-center gap-3 py-1.5 text-xs">
          This {node.kind} is in trash.
          <button className="font-medium underline" onClick={() => notes.restoreNode.mutate(node.id)}>
            Restore
          </button>
        </div>
      )}
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────

/** A page — standalone, or a database row (then saved through the database
 *  so its property values ride along, with the property sheet shown). */
function PageScene({ node, notes }: { node: NodeDetail; notes: NotesHook }) {
  const databaseId = node.isRow ? (node.ancestors.at(-1)?.id ?? null) : null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <NodeHeaderBar node={node} notes={notes} />
      {databaseId ? <RowPage node={node} databaseId={databaseId} /> : <StandalonePage node={node} notes={notes} />}
    </div>
  );
}

function StandalonePage({ node, notes }: { node: NodeDetail; notes: NotesHook }) {
  const navigate = useNavigate();
  const { updateNode } = notes;
  const saver: PageSaver = useMemo(
    () => ({
      save: (patch) => updateNode.mutateAsync({ id: node.id, ...patch }),
      saving: updateNode.isPending,
      remove: () => notes.deleteNode.mutate(node.id),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateNode, node.id],
  );
  const page: EditablePage = useMemo(
    () => ({ id: node.id, title: node.title, icon: node.icon, cover: node.cover, content: node.content, updatedAt: node.updatedAt }),
    // content is only read on mount — the editor owns it afterwards
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id],
  );

  // sub-pages / databases filed under this page (inline ones live in the doc)
  const children = (notes.tree.data?.nodes ?? []).filter((n) => n.parentId === node.id && !n.inline && !n.isRow);
  const canConvert = node.childCount === 0;

  return (
    <NoteEditor
      page={page}
      saver={saver}
      onClose={() => navigate("/apps/notes")}
      onEmbedsChanged={notes.invalidateTree}
      slash={{
        createInlineDatabase: async () => {
          const db = await notes.createNode.mutateAsync({ parentId: node.id, kind: "database", inline: true, title: "Untitled database" });
          return db.id;
        },
      }}
      emptyActions={
        canConvert && (
          <div className="text-muted-foreground mt-6 flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground/60 text-xs">Empty page — start writing, or turn it into:</span>
            <button
              className="hover:bg-accent flex w-fit items-center gap-2 rounded-md px-2 py-1"
              disabled={notes.convertToDatabase.isPending}
              onClick={() => {
                if (window.confirm("Turn this page into a database? This can't be undone."))
                  notes.convertToDatabase.mutate(node.id);
              }}
            >
              <Database size={15} /> Database
            </button>
          </div>
        )
      }
      footer={children.length > 0 && <ChildLinks nodes={children} />}
    />
  );
}

function ChildLinks({ nodes }: { nodes: TreeNode[] }) {
  const navigate = useNavigate();
  return (
    <div className="mt-8 flex flex-col">
      {nodes.map((n) => (
        <button
          key={n.id}
          className="hover:bg-accent text-foreground/80 flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm"
          onClick={() => navigate(`/apps/notes/${n.id}`)}
        >
          <NodeIcon kind={n.kind} icon={n.icon} size={16} />
          <span className="truncate border-b border-current/20">{n.title || "Untitled"}</span>
        </button>
      ))}
    </div>
  );
}

function RowPage({ node, databaseId }: { node: NodeDetail; databaseId: string }) {
  const navigate = useNavigate();
  const view = useNotesView(databaseId);
  const row = view.payload.data?.notes.find((n) => n.noteId === node.id) ?? null;
  const saver = useRowSaver(view, node.id);
  if (!row) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground animate-spin" size={18} />
      </div>
    );
  }
  return (
    <NoteEditor
      page={rowPage(row)}
      saver={saver}
      columns={view.payload.data?.columns ?? []}
      showProperties
      onClose={() => navigate(`/apps/notes/${databaseId}`)}
    />
  );
}

// ─── database ────────────────────────────────────────────────────────────

/** Database page hero — cover, icon, editable title (saves on blur). */
function DatabaseHero({ node, notes, titleRef }: { node: NodeDetail; notes: NotesHook; titleRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const coverInput = useRef<HTMLInputElement>(null);
  const iconInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const coverUrl = assetPreviewUrl(node.cover);
  const iconUrl = assetPreviewUrl(node.icon);

  const upload = (key: "icon" | "cover") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      notes.updateNode.mutate({ id: node.id, [key]: await uploadNodeAsset(node.id, file) });
    } catch (err) {
      alert(`Upload failed: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const autosize = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  const commitTitle = () => {
    const value = titleRef.current?.value.trim() ?? "";
    if (value !== node.title) notes.updateNode.mutate({ id: node.id, title: value });
  };

  return (
    <div className="group/hero flex flex-col">
      {coverUrl && (
        <div className="group/cover relative -mx-4 -mt-12 mb-3 lg:-mx-32">
          <img src={coverUrl} alt="" className="h-40 w-full object-cover lg:h-52" />
          <div className="absolute inset-x-0 bottom-0 hidden justify-end gap-1 p-2 group-hover/cover:flex">
            <Button variant="secondary" size="sm" className="h-6 text-xs" onClick={() => coverInput.current?.click()} disabled={uploading}>
              <ImageIcon size={12} /> Change cover
            </Button>
            <Button variant="secondary" size="sm" className="h-6 text-xs" onClick={() => notes.updateNode.mutate({ id: node.id, cover: null })}>
              Remove
            </Button>
          </div>
        </div>
      )}
      <div className="flex items-start gap-2 pb-1">
        {iconUrl && (
          <button type="button" title="Remove icon" className="shrink-0 pt-1" onClick={() => notes.updateNode.mutate({ id: node.id, icon: null })}>
            <img src={iconUrl} alt="" className="size-10 rounded-md object-contain" />
          </button>
        )}
        <div className="relative min-w-0 flex-1">
          <div className="absolute -top-6 left-0 z-10 hidden gap-1 group-hover/hero:flex">
            {!iconUrl && (
              <Button variant="secondary" size="sm" className="h-6 gap-1 text-xs shadow-sm" onClick={() => iconInput.current?.click()} disabled={uploading}>
                <Smile size={12} /> Add icon
              </Button>
            )}
            {!coverUrl && (
              <Button variant="secondary" size="sm" className="h-6 gap-1 text-xs shadow-sm" onClick={() => coverInput.current?.click()} disabled={uploading}>
                <ImageIcon size={12} /> Add cover
              </Button>
            )}
          </div>
          <textarea
            ref={titleRef}
            rows={1}
            defaultValue={node.title}
            placeholder="Untitled database"
            className="min-h-10 w-full resize-none overflow-hidden border-none bg-transparent text-2xl font-bold leading-10 outline-none placeholder:text-muted-foreground/40"
            onBlur={commitTitle}
            onFocus={autosize}
            onChange={autosize}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            aria-label="Database name"
          />
        </div>
      </div>
      <input ref={iconInput} type="file" accept="image/*" className="hidden" onChange={upload("icon")} />
      <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={upload("cover")} />
    </div>
  );
}

function DatabaseScene({
  node,
  notes,
  openNoteId,
  setOpenNoteId,
}: {
  node: NodeDetail;
  notes: NotesHook;
  openNoteId: string | null;
  setOpenNoteId: (id: string | null) => void;
}) {
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Scroller width — the hero pins to it (sticky-left) so wide tables scroll
  // under the title row instead of carrying it away.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollerWidth, setScrollerWidth] = useState(0);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setScrollerWidth(el.clientWidth));
    ro.observe(el);
    setScrollerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <NodeHeaderBar node={node} notes={notes} onRename={() => titleRef.current?.focus()} />
      {/* page scroller — hero + views; x-spill for wide tables */}
      <div ref={scrollerRef} className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="sticky left-0 z-10" style={{ width: scrollerWidth || undefined }}>
          <div className="px-4 pt-12 pb-2 lg:px-32">
            <DatabaseHero node={node} notes={notes} titleRef={titleRef} />
          </div>
        </div>
        <div className="w-max min-w-full">
          <NotesView databaseId={node.id} openNoteId={openNoteId} setOpenNoteId={setOpenNoteId} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ notFound = false }: { notFound?: boolean }) {
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <NotebookPen size={28} className="text-muted-foreground/50" aria-hidden="true" />
        <p className="text-muted-foreground text-sm font-medium">{notFound ? "Page not found" : "Notes"}</p>
        <p className="text-muted-foreground/70 max-w-xs text-center text-xs">
          {notFound
            ? "It may have been deleted."
            : "Pick a page from the sidebar, or hit + on a section to add one. Any empty page can become a database."}
        </p>
      </div>
    </div>
  );
}
