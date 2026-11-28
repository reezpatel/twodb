import { useCallback, useEffect, useState } from "react";
import { twopinClient, type BookmarkFolderDto } from "../../lib/twopin-client.js";

/** Business hook: bookmark folder list + create/update/delete (folders can nest via parentId). */
export function useBookmarkFolders() {
  const [folders, setFolders] = useState<BookmarkFolderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setFolders(await twopinClient.listBookmarkFolders());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createFolder = useCallback(async (name: string, parentId?: string | null) => {
    const folder = await twopinClient.createBookmarkFolder({ name, parentId: parentId ?? null });
    setFolders((prev) => [...prev, folder]);
    return folder;
  }, []);

  const updateFolder = useCallback(async (id: string, patch: { name?: string; parentId?: string | null }) => {
    const folder = await twopinClient.updateBookmarkFolder(id, patch);
    setFolders((prev) => prev.map((f) => (f.id === id ? folder : f)));
    return folder;
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    await twopinClient.deleteBookmarkFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { folders, loading, error, reload, createFolder, updateFolder, deleteFolder };
}

