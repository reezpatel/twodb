import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ImageIcon, MoreHorizontal, NotebookPen, Pencil, Share2, Smile, Star, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useNotes, type NoteFolder, type NoteGroup } from "./notes-provider";
import { CreatePanel } from "./scene/create-panel";
import { NotesView } from "./view/notes-view";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

/** Breadcrumb segments incl. the group itself: first two + last two, "…" between. */
function collapsePath(parts: string[], current: string): string[] {
  const all = [...parts, current];
  if (all.length <= 4) return all;
  return [all[0], all[1], "…", all[all.length - 2], all[all.length - 1]];
}

/** twodb:// asset uri → org-scoped preview URL. */
function assetPreviewUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const id = /^twodb:\/\/[^/]+\/([A-Za-z0-9-_.]+)$/.exec(uri)?.[1];
  return id ? `/api/notes/assets/${id}` : null;
}

/** Page hero — cover image, icon, editable title (saves on focus-out). */
function GroupPageHero({
  group,
  notes,
  titleRef,
}: {
  group: NoteGroup;
  notes: ReturnType<typeof useNotes>["notes"];
  titleRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const coverInput = useRef<HTMLInputElement>(null);
  const iconInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const decorations = group.metadata ?? {};
  const coverUrl = assetPreviewUrl(decorations.cover);
  const iconUrl = assetPreviewUrl(decorations.icon);

  const upload = async (file: File, apply: (uri: string) => void) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/notes/groups/${group.id}/assets`, { method: "POST", body, credentials: "include" });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "upload failed");
      }
      const asset = (await res.json()) as { uri: string };
      apply(asset.uri);
    } catch (e) {
      alert(
        `Upload failed: ${(e as Error).message}${(e as Error).message.includes("not_configured") ? " — configure Notes Storage in Settings → Storage" : ""}`,
      );
    } finally {
      setUploading(false);
    }
  };

  const pickCover = () => coverInput.current?.click();
  const setCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) void upload(e.target.files[0], (uri) => notes.setGroupDecorations.mutate({ id: group.id, cover: uri }));
    e.target.value = "";
  };
  const setIcon = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) void upload(e.target.files[0], (uri) => notes.setGroupDecorations.mutate({ id: group.id, icon: uri }));
    e.target.value = "";
  };

  const autosize = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const commitTitle = () => {
    const value = titleRef.current?.value.trim() ?? "";
    if (value && value !== group.name) notes.renameGroup.mutate({ id: group.id, name: value });
  };

  return (
    <div className="group/hero flex flex-col">
      {coverUrl && (
        <div className="group/cover relative -mx-4 -mt-4 mb-3 lg:-mx-12 lg:-mt-6">
          <img src={coverUrl} alt="" className="h-40 w-full object-cover lg:h-52" />
          <div className="absolute inset-x-0 bottom-0 hidden justify-end gap-1 p-2 group-hover/cover:flex">
            <Button variant="secondary" size="sm" className="h-6 text-xs" onClick={pickCover} disabled={uploading}>
              <ImageIcon size={12} /> Change cover
            </Button>
            <Button variant="secondary" size="sm" className="h-6 text-xs" onClick={() => notes.setGroupDecorations.mutate({ id: group.id, cover: null })}>
              Remove
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 pb-1">
        {/* icon slot — only rendered when an icon is set; otherwise an
            "Add icon" chip floats above the title on hero hover. */}
        {iconUrl && (
          <div className="group/icon relative shrink-0 pt-1">
            <input ref={iconInput} type="file" accept="image/*" className="hidden" onChange={setIcon} />
            <button
              type="button"
              title="Remove icon"
              className="flex size-11 items-center justify-center rounded-md text-3xl leading-none"
              onClick={() => notes.setGroupDecorations.mutate({ id: group.id, icon: null })}
            >
              <img src={iconUrl} alt="" className="size-10 rounded-md object-contain" />
            </button>
          </div>
        )}
        <div className="relative min-w-0 flex-1">
          {/* floating action chips above the title (hover the hero) */}
          <div className="absolute -top-6 left-0 z-10 hidden gap-1 group-hover/hero:flex">
            {!iconUrl && (
              <Button variant="secondary" size="sm" className="h-6 gap-1 text-xs shadow-sm" onClick={() => iconInput.current?.click()} disabled={uploading}>
                <Smile size={12} /> Add icon
              </Button>
            )}
            {!coverUrl && (
              <Button variant="secondary" size="sm" className="h-6 gap-1 text-xs shadow-sm" onClick={pickCover} disabled={uploading}>
                <ImageIcon size={12} /> Add cover
              </Button>
            )}
          </div>
          <textarea
            ref={titleRef}
            rows={1}
            defaultValue={group.name}
            className="text-2xl font-bold leading-10 min-h-10 w-full resize-none overflow-hidden border-none bg-transparent outline-none placeholder:text-muted-foreground/40"
            onBlur={commitTitle}
            onFocus={autosize}
            onChange={autosize}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            aria-label="Group name"
          />
        </div>
      </div>

      {/* both inputs stay mounted so the chips and the icon button share them */}
      <input ref={iconInput} type="file" accept="image/*" className="hidden" onChange={setIcon} />
      <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={setCover} />
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
  const pathParts = folderPathParts(foldersById, group.folderId);
  const crumbs = collapsePath(pathParts, group.name);
  const fullTitle = [...pathParts, group.name].join(" / ");
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  // Scroller width — the hero pins to it (sticky-left) so wide tables scroll
  // under the title row instead of carrying it away.
  const [scrollerWidth, setScrollerWidth] = useState(0);
  useEffect(() => {
    const el = document.querySelector("main [class*='overflow-auto']");
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setScrollerWidth(el.clientWidth));
    ro.observe(el);
    setScrollerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header bar — breadcrumb left, actions right; sits above the scroller
          so it never moves while the content below scrolls. */}
      <div className="bg-background z-30 shrink-0">
        <div className="flex h-9 items-center gap-2 px-4">
          <span className="text-muted-foreground/60 flex min-w-0 flex-1 items-center gap-1 truncate text-sm" title={fullTitle}>
            {crumbs.map((part, i) => (
              <span key={`${part}-${i}`} className={cn("flex min-w-0 items-center gap-1", i === crumbs.length - 1 && "text-foreground/80 font-medium")}>
                {i > 0 && <ChevronRight size={11} className="text-muted-foreground/40 shrink-0" aria-hidden="true" />}
                <span className="truncate">{part}</span>
              </span>
            ))}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2 text-xs"
              disabled
              title="Share (coming soon)"
            >
              <Share2 size={13} /> Share
            </Button>
            <button
              className={cn("px-1.5 text-xs leading-none", group.isFavorite ? "text-warning" : "text-muted-foreground/70 hover:text-foreground")}
              title={group.isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => notes.toggleFavorite.mutate({ id: group.id, isFavorite: !group.isFavorite })}
            >
              <Star size={14} fill={group.isFavorite ? "currentColor" : "none"} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground/70 hover:text-foreground px-1.5 leading-none" title="More">
                  <MoreHorizontal size={15} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => titleRef.current?.focus()}>
                  <Pencil size={13} /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    if (window.confirm(`Delete "${group.name}" and all its notes? This cannot be undone.`)) {
                      notes.deleteGroup.mutate(group.id);
                      navigate("/apps/notes");
                    }
                  }}
                >
                  <Trash2 size={13} /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* scrollable content — hero + views; x-spill for wide tables. The hero
          pins to the scroller's visible width (sticky-left) like the tab bar. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="sticky left-0 z-10 w-max" style={{ width: scrollerWidth || undefined }}>
          <div className="px-4 pb-2 lg:px-32 pt-12">
            <GroupPageHero group={group} notes={notes} titleRef={titleRef} />
          </div>
        </div>
        <div className="w-max min-w-full">
          <NotesView key={group.id} groupId={group.id} openNoteId={openNoteId} setOpenNoteId={setOpenNoteId} />
        </div>
      </div>
    </div>
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

function folderPathParts(foldersById: Map<string, NoteFolder>, folderId: string): string[] {
  const parts: string[] = [];
  let current: string | null = folderId;
  while (current) {
    const folder = foldersById.get(current);
    if (!folder) break;
    parts.unshift(folder.name);
    current = folder.parentId;
  }
  return parts;
}
