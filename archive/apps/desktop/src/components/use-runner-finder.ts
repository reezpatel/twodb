import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface RunnerOption {
  id: string;
  name: string;
  hostname: string | null;
  online: boolean;
}

export interface RunnerFsEntry {
  name: string;
  dir: boolean;
}

interface RunnerFsListing {
  path: string;
  entries: RunnerFsEntry[];
}

export type FinderSelectionMode = "file" | "folder" | "any";

export interface FinderSelection {
  runnerId: string;
  runnerName: string;
  path: string;
  entry: RunnerFsEntry | null;
}

interface FinderLocation {
  runnerId: string | null;
  path: string;
}

export function joinFsPath(dir: string, name: string) {
  return dir.endsWith("/") ? `${dir}${name}` : `${dir}/${name}`;
}

export function useRunnerFinder({
  mode = "folder",
  runnerId,
  onSelectionChange,
}: {
  mode?: FinderSelectionMode;
  runnerId?: string;
  onSelectionChange?: (selection: FinderSelection | null) => void;
} = {}) {
  const [history, setHistory] = useState<{ stack: FinderLocation[]; index: number }>(() => ({
    stack: [{ runnerId: runnerId ?? null, path: "~" }],
    index: 0,
  }));
  const [highlight, setHighlight] = useState<string | null>(null);
  const [pathDraft, setPathDraft] = useState<string | null>(null);
  const pendingJumpRef = useRef(false);

  const location = history.stack[history.index] ?? history.stack[0];
  const isPicker = location.runnerId === null;

  const runners = useQuery({
    queryKey: ["runners"],
    queryFn: () => api<RunnerOption[]>("/api/runners"),
    staleTime: 15_000,
  });

  const listing = useQuery({
    queryKey: ["runners", "fs", location.runnerId, location.path],
    queryFn: () => api<RunnerFsListing>(`/api/runners/${location.runnerId}/fs?path=${encodeURIComponent(location.path)}`),
    enabled: !isPicker,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });

  const entries = useMemo(() => {
    const list = listing.data?.entries ?? [];
    return [...list].sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  }, [listing.data]);

  const runnerName = useMemo(() => runners.data?.find((r) => r.id === location.runnerId)?.name ?? location.runnerId ?? "", [runners.data, location.runnerId]);

  const navigate = useCallback((next: FinderLocation) => {
    setHistory((prev) => ({ stack: [...prev.stack.slice(0, prev.index + 1), next], index: prev.index + 1 }));
    setHighlight(null);
  }, []);

  const openRunner = useCallback((id: string) => navigate({ runnerId: id, path: "~" }), [navigate]);

  const openEntry = useCallback(
    (entry: RunnerFsEntry) => {
      if (!location.runnerId || !listing.data) return;
      if (!entry.dir) {
        setHighlight(entry.name);
        return;
      }
      navigate({ runnerId: location.runnerId, path: joinFsPath(listing.data.path, entry.name) });
    },
    [listing.data, location.runnerId, navigate],
  );

  const commitPath = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || isPicker) return;
      pendingJumpRef.current = true;
      navigate({ runnerId: location.runnerId, path: trimmed });
    },
    [isPicker, location.runnerId, navigate],
  );

  // A successful listing for the jumped-to path releases the path input back
  // to mirroring the resolved path; a failed jump keeps the typed value so it
  // can be corrected.
  useEffect(() => {
    if (pendingJumpRef.current && listing.isSuccess) {
      pendingJumpRef.current = false;
      setPathDraft(null);
    }
  }, [listing.isSuccess, listing.data]);

  const goBack = useCallback(() => {
    setHistory((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }));
    setHighlight(null);
    setPathDraft(null);
  }, []);

  const goForward = useCallback(() => {
    setHistory((prev) => ({ ...prev, index: Math.min(prev.stack.length - 1, prev.index + 1) }));
    setHighlight(null);
    setPathDraft(null);
  }, []);

  const selection = useMemo<FinderSelection | null>(() => {
    if (!location.runnerId || !listing.data) return null;
    if (mode === "folder") {
      return { runnerId: location.runnerId, runnerName, path: listing.data.path, entry: null };
    }
    const entry = entries.find((e) => e.name === highlight);
    if (!entry) return null;
    if (mode === "file" && entry.dir) return null;
    return { runnerId: location.runnerId, runnerName, path: joinFsPath(listing.data.path, entry.name), entry };
  }, [entries, highlight, listing.data, location.runnerId, mode, runnerName]);

  useEffect(() => {
    onSelectionChange?.(selection);
  }, [onSelectionChange, selection]);

  const rows = useMemo<{ id: string; runner?: RunnerOption; entry?: RunnerFsEntry }[]>(() => {
    if (isPicker) return (runners.data ?? []).map((runner) => ({ id: runner.id, runner }));
    return entries.map((entry) => ({ id: entry.name, entry }));
  }, [entries, isPicker, runners.data]);

  const openRow = useCallback(
    (row: { runner?: RunnerOption; entry?: RunnerFsEntry }) => {
      if (row.runner) {
        if (row.runner.online) openRunner(row.runner.id);
        return;
      }
      if (row.entry) openEntry(row.entry);
    },
    [openEntry, openRunner],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (rows.length === 0) return;
        const current = rows.findIndex((row) => row.id === highlight);
        const fallback = event.key === "ArrowDown" ? 0 : rows.length - 1;
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = current === -1 ? fallback : Math.min(rows.length - 1, Math.max(0, current + step));
        setHighlight(rows[next].id);
        return;
      }
      if (event.key === "Enter") {
        const row = rows.find((r) => r.id === highlight);
        if (row) openRow(row);
      }
    },
    [highlight, openRow, rows],
  );

  const pathValue = pathDraft ?? (isPicker ? "" : (listing.data?.path ?? location.path));
  const isLoading = listing.isPending || (listing.isFetching && listing.isPlaceholderData);

  return {
    isPicker,
    runners: runners.data ?? [],
    rows,
    entries,
    isLoading: !isPicker && isLoading,
    isRunnersLoading: isPicker && runners.isPending,
    error: isPicker ? null : listing.error,
    pathValue,
    setPathDraft,
    commitPath,
    highlight,
    setHighlight,
    runnerName,
    canGoBack: history.index > 0,
    canGoForward: history.index < history.stack.length - 1,
    goBack,
    goForward,
    openRunner,
    openEntry,
    openRow,
    handleKeyDown,
    selection,
  };
}
