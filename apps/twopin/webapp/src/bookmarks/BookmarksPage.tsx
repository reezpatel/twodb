import { useMemo } from "react";
import { usePageHeader } from "../shell/usePageHeader.js";
import { useBookmarksPage } from "./hooks/useBookmarksPage.js";
import type { BookmarkSelection } from "./hooks/useBookmarks.js";
import { FolderList } from "./partials/FolderList.js";
import { BookmarkRow } from "./partials/BookmarkRow.js";
import { AddBookmarkDialog } from "./AddBookmarkDialog.js";
import { EditBookmarkDialog } from "./EditBookmarkDialog.js";
import { Bookmark } from "lucide-react";

/** Bookmarks page: folder rail + simple link list. */
export function BookmarksPage({ selection }: { selection: BookmarkSelection }) {
  const state = useBookmarksPage(selection);

  const totalCount = useMemo(() => state.folders.reduce((s, f) => s + f.bookmarkCount, 0), [state.folders]);

  const title =
    selection === "all" ? "All bookmarks" : selection === "unfiled" ? "Unfiled" : (state.selectedFolder?.name ?? "Bookmarks");

  usePageHeader({
    title,
    subtitle: `${state.bookmarks.length} bookmark${state.bookmarks.length === 1 ? "" : "s"}`,
    actionLabel: "Add bookmark",
    onAction: () => state.setAddOpen(true),
  });

  return (
    <div className="flex h-full min-h-0">
      <FolderList
        folders={state.folders}
        loading={state.foldersLoading}
        selection={selection}
        totalCount={totalCount}
        onSelect={state.select}
        onCreateFolder={state.createFolder}
        onRenameFolder={state.renameFolder}
        onDeleteFolder={state.deleteFolder}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
        {state.bookmarksLoading && state.bookmarks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">Loading bookmarks…</div>
        ) : state.bookmarksError ? (
          <div className="flex flex-1 items-center justify-center text-sm text-destructive">{state.bookmarksError}</div>
        ) : state.bookmarks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <Bookmark className="size-10 text-ink-muted" />
            <p className="text-sm text-ink-muted">No bookmarks here yet.</p>
            <button className="text-sm font-semibold text-ion-deep hover:underline" onClick={() => state.setAddOpen(true)}>
              Add your first bookmark →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {state.bookmarks.map((bookmark) => (
              <BookmarkRow key={bookmark.id} bookmark={bookmark} onEdit={state.setEditing} onDelete={state.deleteBookmark} />
            ))}
          </div>
        )}
      </div>

      <AddBookmarkDialog
        open={state.addOpen}
        onOpenChange={state.setAddOpen}
        folders={state.folders}
        defaultFolderId={state.selectedFolder?.id ?? null}
        onCreate={state.createBookmark}
      />
      <EditBookmarkDialog
        bookmark={state.editing}
        folders={state.folders}
        onOpenChange={(open) => !open && state.setEditing(null)}
        onSave={state.updateBookmark}
      />
    </div>
  );
}

