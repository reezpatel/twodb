import { QueryClient, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useMemo } from "react";
import type { FieldConfig, UserFieldType, ViewConfig, ViewType } from "@shared/model";
import { api, gateway, getSpace, type RecordPatch, type RowQueryInput } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 } },
});

export const keys = {
  tree: () => ["tree", getSpace()] as const,
  children: (id: string) => ["children", id] as const,
  record: (id: string) => ["record", id] as const,
  database: (id: string) => ["database", id] as const,
  rows: (id: string, q?: unknown) => (q === undefined ? (["rows", id] as const) : (["rows", id, q] as const)),
  backlinks: (id: string) => ["backlinks", id] as const,
  trash: () => ["trash", getSpace()] as const,
};

export const useTree = () => useQuery({ queryKey: keys.tree(), queryFn: api.tree });
export const useChildren = (id: string, enabled: boolean) => useQuery({ queryKey: keys.children(id), queryFn: () => api.children(id), enabled });
export const useRecord = (id: string | null | undefined) => useQuery({ queryKey: keys.record(id ?? ""), queryFn: () => api.record(id!), enabled: !!id });
export const useDatabase = (id: string | null | undefined) => useQuery({ queryKey: keys.database(id ?? ""), queryFn: () => api.database(id!), enabled: !!id });
export const useRows = (id: string | null | undefined, q: RowQueryInput) =>
  useQuery({ queryKey: keys.rows(id ?? "", q), queryFn: () => api.query(id!, q), enabled: !!id, placeholderData: keepPreviousData });
export const useBacklinks = (id: string) => useQuery({ queryKey: keys.backlinks(id), queryFn: () => api.backlinks(id) });
export const useTrash = () => useQuery({ queryKey: keys.trash(), queryFn: api.trashList });
export const useMembers = () => useQuery({ queryKey: ["members"], queryFn: gateway.members, staleTime: 300_000 });
export const useSpaces = () => useQuery({ queryKey: ["spaces"], queryFn: gateway.spaces, staleTime: 300_000 });

/** All writes + the cache invalidation each one implies. */
export function useGarden() {
  const qc = useQueryClient();
  return useMemo(() => {
    const inv = (...k: readonly unknown[][]) => Promise.all(k.map((queryKey) => qc.invalidateQueries({ queryKey })));
    const structure = () => inv(["tree"], ["children"]);
    return {
      async createPage(b: { parentId?: string | null; title?: string; values?: Record<string, unknown> }) {
        const page = await api.createPage(b);
        await Promise.all([structure(), inv(["rows", page.databaseId!])]);
        return page;
      },
      async createDatabase(b: { parentId?: string | null; title?: string; inline?: boolean }) {
        const d = await api.createDatabase(b);
        await structure();
        return d;
      },
      async patchRecord(id: string, b: RecordPatch, opts: { quiet?: boolean } = {}) {
        await api.patchRecord(id, b);
        if (opts.quiet) return; // content autosave: nothing else displays it
        const visual = b.title !== undefined || b.icon !== undefined || b.isFavorite !== undefined || b.parentId !== undefined || b.position !== undefined;
        await Promise.all([inv(["record", id]), visual ? Promise.all([structure(), inv(["rows"]), inv(["record"])]) : null]);
      },
      async setValues(id: string, values: Record<string, unknown>) {
        const rec = await api.setValues(id, values);
        qc.setQueryData(keys.record(id), rec);
        await inv(["rows"], ["record"]);
        if ("title" in values) await structure();
        return rec;
      },
      async trash(id: string) {
        await api.trash(id);
        await Promise.all([structure(), inv(["rows"]), inv(["trash"]), inv(["record", id])]);
      },
      async restore(id: string) {
        await api.restore(id);
        await Promise.all([structure(), inv(["rows"]), inv(["trash"]), inv(["record"])]);
      },
      async deleteForever(id: string) {
        await api.deleteForever(id);
        await inv(["trash"]);
      },
      async emptyTrash() {
        await api.emptyTrash();
        await inv(["trash"]);
      },
      async createField(dbId: string, b: { name: string; type: UserFieldType; config?: FieldConfig; twoWay?: boolean; reverseName?: string; position?: number }) {
        const f = await api.createField(dbId, b);
        await inv(["database"], ["rows"], ["record"]);
        return f;
      },
      async patchField(id: string, b: { name?: string; type?: UserFieldType; config?: FieldConfig; position?: number }) {
        const f = await api.patchField(id, b);
        await inv(["database"], ["rows"], ["record"]);
        return f;
      },
      async deleteField(id: string) {
        await api.deleteField(id);
        await inv(["database"], ["rows"], ["record"]);
      },
      async createView(dbId: string, b: { name: string; type: ViewType; config?: ViewConfig }) {
        const v = await api.createView(dbId, b);
        await inv(["database", dbId]);
        return v;
      },
      async patchView(dbId: string, id: string, b: { name?: string; type?: ViewType; config?: ViewConfig; position?: number }) {
        // optimistic: views drive what's on screen, keep it snappy
        qc.setQueryData(keys.database(dbId), (old: Awaited<ReturnType<typeof api.database>> | undefined) =>
          old ? { ...old, views: old.views.map((v) => (v.id === id ? { ...v, ...b, config: b.config ?? v.config } : v)) } : old,
        );
        const v = await api.patchView(id, b);
        await inv(["database", dbId], ["rows", dbId]);
        return v;
      },
      async duplicateView(dbId: string, id: string) {
        const v = await api.duplicateView(id);
        await inv(["database", dbId]);
        return v;
      },
      async deleteView(dbId: string, id: string) {
        await api.deleteView(id);
        await inv(["database", dbId]);
      },
    };
  }, [qc]);
}

export type Garden = ReturnType<typeof useGarden>;
