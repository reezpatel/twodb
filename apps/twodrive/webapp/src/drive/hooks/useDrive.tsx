import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { driveClient, type BackendDto, type VirtualStorageDto, type EntryDto } from "../../lib/drive-client.js";

// ---------------------------------------------------------------------------
// Holding hook for the whole drive: sidebar tree (backends → virtual
// storages), the active virtual storage + path, and the entry list of the
// open folder. Mirrors the legacy useFilesScene (files-provider) but for
// virtual storages.
// ---------------------------------------------------------------------------

export type View = "files" | "trash" | "shares" | "settings";

export interface DriveState {
  view: View;
  backends: BackendDto[];
  storages: VirtualStorageDto[];
  treeLoading: boolean;
  treeError: string | null;

  activeStorageId: string | null;
  activeStorage: VirtualStorageDto | null;
  path: string;

  entries: EntryDto[];
  entriesLoading: boolean;
  entriesError: string | null;

  selectView(view: View): void;
  openStorage(id: string): void;
  openFolder(path: string): void;
  navigateTo(segmentCount: number): void;
  refreshTree(): void;
  refreshEntries(): void;
}

const DriveContext = createContext<DriveState | null>(null);

export function DriveProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("files");
  const [backends, setBackends] = useState<BackendDto[]>([]);
  const [storages, setStorages] = useState<VirtualStorageDto[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [activeStorageId, setActiveStorageId] = useState<string | null>(null);
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<EntryDto[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  const refreshTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const res = await driveClient.listTree();
      setBackends(res.backends);
      setStorages(res.storages);
      setTreeError(null);
      // Keep the active storage valid.
      setActiveStorageId((cur) => (cur && res.storages.some((s) => s.id === cur) ? cur : res.storages[0]?.id ?? null));
    } catch (e) {
      setTreeError(e instanceof Error ? e.message : String(e));
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  const activeStorage = useMemo(() => storages.find((s) => s.id === activeStorageId) ?? null, [storages, activeStorageId]);

  const refreshEntries = useCallback(async () => {
    if (!activeStorageId) {
      setEntries([]);
      return;
    }
    setEntriesLoading(true);
    try {
      const res = await driveClient.listEntries(activeStorageId, path, view === "trash");
      setEntries(res.entries);
      setEntriesError(null);
    } catch (e) {
      setEntriesError(e instanceof Error ? e.message : String(e));
    } finally {
      setEntriesLoading(false);
    }
  }, [activeStorageId, path, view]);

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  const selectView = useCallback((next: View) => {
    setView(next);
    setPath("");
  }, []);

  const openStorage = useCallback((id: string) => {
    setActiveStorageId(id);
    setPath("");
    setView("files");
  }, []);

  const openFolder = useCallback((folderPath: string) => {
    setPath(folderPath);
    setView("files");
  }, []);

  const navigateTo = useCallback((segmentCount: number) => {
    setPath((cur) => cur.split("/").slice(0, segmentCount).join("/"));
  }, []);

  const value: DriveState = {
    view,
    backends,
    storages,
    treeLoading,
    treeError,
    activeStorageId,
    activeStorage,
    path,
    entries,
    entriesLoading,
    entriesError,
    selectView,
    openStorage,
    openFolder,
    navigateTo,
    refreshTree,
    refreshEntries,
  };

  return <DriveContext.Provider value={value}>{children}</DriveContext.Provider>;
}

export function useDrive() {
  const ctx = useContext(DriveContext);
  if (!ctx) throw new Error("useDrive must be used within DriveProvider");
  return ctx;
}
