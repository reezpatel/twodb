import { useCallback, useEffect, useState } from "react";
import { driveClient, type EntryDto } from "../../lib/drive-client.js";
import { useDrive } from "./useDrive.js";

/** Business hook: mutations on entries of the active storage (upload, mkdir,
 * rename, move, copy, trash/restore/purge). All refresh the list on success. */
export function useEntryActions() {
  const { activeStorageId, path, refreshEntries, refreshTree } = useDrive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        refreshEntries();
        refreshTree();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refreshEntries, refreshTree],
  );

  return {
    busy,
    error,
    upload: (files: FileList | File[]) =>
      activeStorageId &&
      Promise.all(
        Array.from(files).map((file) =>
          driveClient.uploadFile(
            activeStorageId,
            path ? `${path}/${file.name}` : file.name,
            file,
            file.type || undefined,
          ),
        ),
      ).then(() => {
        refreshEntries();
        refreshTree();
      }),
    mkdir: (folderPath: string) => activeStorageId && run(() => driveClient.createFolder(activeStorageId, folderPath)),
    rename: (entryPath: string, newName: string) =>
      activeStorageId && run(() => driveClient.renameEntry(activeStorageId, entryPath, newName)),
    move: (from: string, to: string) => activeStorageId && run(() => driveClient.moveEntry(activeStorageId, from, to)),
    copy: (from: string, to: string) => activeStorageId && run(() => driveClient.copyEntry(activeStorageId, from, to)),
    trash: (entryPaths: string[]) => activeStorageId && run(() => driveClient.trashEntries(activeStorageId, entryPaths)),
    restore: (entryIds: string[]) => activeStorageId && run(() => driveClient.restoreEntries(activeStorageId, entryIds)),
    purge: (entryPaths: string[]) => activeStorageId && run(() => driveClient.purgeEntries(activeStorageId, entryPaths)),
    emptyTrash: () => activeStorageId && run(() => driveClient.emptyTrash(activeStorageId)),
    share: async (entryPath: string) => {
      if (!activeStorageId) throw new Error("no active storage");
      return driveClient.createShare(activeStorageId, entryPath);
    },
  };
}

/** Business hook: search + recent files for the active storage. */
export function useSearchRecent() {
  const { activeStorageId } = useDrive();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EntryDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<EntryDto[]>([]);

  useEffect(() => {
    if (!activeStorageId) return;
    let cancelled = false;
    driveClient
      .recentFiles(activeStorageId)
      .then((r) => !cancelled && setRecent(r.entries))
      .catch(() => !cancelled && setRecent([]));
    return () => {
      cancelled = true;
    };
  }, [activeStorageId]);

  useEffect(() => {
    if (!activeStorageId || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      driveClient
        .searchFiles(activeStorageId, query.trim())
        .then((r) => setResults(r.entries))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [activeStorageId, query]);

  return { query, setQuery, results, searching, recent };
}
