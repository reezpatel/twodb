import { useCallback, useEffect, useState } from "react";
import { twopinClient, type BookmarkDto } from "../../lib/twopin-client.js";

/** Which slice of bookmarks to show: all, unfiled, or one folder. */
export type BookmarkSelection = "all" | "unfiled" | string;

/** Business hook: bookmarks for the current selection. */
export function useBookmarks(selection: BookmarkSelection) {
  const [bookmarks, setBookmarks] = useState<BookmarkDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setBookmarks(await twopinClient.listBookmarks(selection === "all" ? undefined : selection));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selection]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createBookmark = useCallback(
    async (input: { folderId?: string | null; url: string; title?: string; description?: string }) => {
      const bookmark = await twopinClient.createBookmark(input);
      await reload(); // selection-dependent; simplest correct refresh
      return bookmark;
    },
    [reload],
  );

  const updateBookmark = useCallback(
    async (id: string, patch: { folderId?: string | null; url?: string; title?: string | null; description?: string | null }) => {
      const bookmark = await twopinClient.updateBookmark(id, patch);
      await reload();
      return bookmark;
    },
    [reload],
  );

  const deleteBookmark = useCallback(async (id: string) => {
    await twopinClient.deleteBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { bookmarks, loading, error, reload, createBookmark, updateBookmark, deleteBookmark };
}

