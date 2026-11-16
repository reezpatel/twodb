import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, qs } from "./api";
import type { FileContent, Site, Version, VersionDetail } from "./types";

/** Every TwoPager query key starts with "tp" so one invalidation refreshes everything derived from a change. */
const k = (...parts: unknown[]) => ["tp", ...parts] as const;

const reg = async <R,>(path: string): Promise<R> => {
  const r = await fetch(path, { credentials: "include" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
};

export const useSpaces = () => useQuery({ queryKey: k("_spaces"), queryFn: () => reg<{ spaces: { id: string; name: string }[] }>("/registry/spaces").then((r) => r.spaces), staleTime: 60_000 });
export const useSites = (spaceId: string) => useQuery({ queryKey: k(spaceId, "sites"), queryFn: () => get<Site[]>(`/sites${qs({ spaceId })}`) });
export const useSite = (siteId: string) => useQuery({ queryKey: k("site", siteId), queryFn: () => get<Site>(`/sites/${siteId}`) });
export const useVersions = (siteId: string) => useQuery({ queryKey: k("site", siteId, "versions"), queryFn: () => get<Version[]>(`/sites/${siteId}/versions`) });
export const useVersion = (siteId: string, versionId: string | null) =>
  useQuery({ queryKey: k("site", siteId, "version", versionId), queryFn: () => get<VersionDetail>(`/sites/${siteId}/versions/${versionId}`), enabled: !!versionId });
export const useFile = (siteId: string, versionId: string | null, path: string | null) =>
  useQuery({ queryKey: k("site", siteId, "file", versionId, path), queryFn: () => get<FileContent>(`/sites/${siteId}/versions/${versionId}/file${qs({ path })}`), enabled: !!versionId && !!path });

/** Mutation that refreshes every TwoPager query on success. */
export function useApiMutation<V = void, R = unknown>(fn: (v: V) => Promise<R>, onSuccess?: (r: R) => void) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ["tp"] }); onSuccess?.(r); } });
}
