import { useCallback, useMemo, useState } from "react";
import type { BookmarkDto } from "../../lib/twopin-client.js";
import { navigate } from "../../lib/router.js";
import { useBookmarkFolders } from "./useBookmarkFolders.js";
import { useBookmarks, type BookmarkSelection } from "./useBookmarks.js";

/** Holding hook for BookmarksPage: folders + bookmarks + selection + dialogs. */
export function useBookmarksPage(selection: BookmarkSelection) {
  const folders = useBookmarkFolders();
  const bookmarks = useBookmarks(selection);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<BookmarkDto | null>(null);

  const selectedFolder = useMemo(
    () => (selection === "all" || selection === "unfiled" ? undefined : folders.folders.find((f) => f.id === selection)),
    [selection, folders.folders],
  );

  const select = useCallback((sel: BookmarkSelection) => {
    navigate(sel === "all" ? "/bookmarks" : `/bookmarks/${sel}`);
  }, []);

  const createFolder = useCallback(
    async (name: string, parentId?: string | null) => {
      const folder = await folders.createFolder(name, parentId);
      navigate(`/bookmarks/${folder.id}`);
      return folder;
    },
    [folders],
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => folders.updateFolder(id, { name }),
    [folders],
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      await folders.deleteFolder(id);
      if (selection === id) navigate("/bookmarks");
    },
    [folders, selection],
  );

  const createBookmark = useCallback(
    async (input: { folderId?: string | null; url: string; title?: string; description?: string }) => {
      const bookmark = await bookmarks.createBookmark(input);
      await folders.reload(); // counts changed
      return bookmark;
    },
    [bookmarks, folders],
  );

  const updateBookmark = useCallback(
    async (id: string, patch: { folderId?: string | null; url?: string; title?: string | null; description?: string | null }) => {
      const bookmark = await bookmarks.updateBookmark(id, patch);
      await folders.reload();
      return bookmark;
    },
    [bookmarks, folders],
  );

  const deleteBookmark = useCallback(
    async (id: string) => {
      await bookmarks.deleteBookmark(id);
      await folders.reload();
    },
    [bookmarks, folders],
  );

  return {
    folders: folders.folders,
    foldersLoading: folders.loading,
    createFolder,
    renameFolder,
    deleteFolder,
    selection,
    selectedFolder,
    select,
    bookmarks: bookmarks.bookmarks,
    bookmarksLoading: bookmarks.loading,
    bookmarksError: bookmarks.error,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    addOpen,
    setAddOpen,
    editing,
    setEditing,
  };
}

