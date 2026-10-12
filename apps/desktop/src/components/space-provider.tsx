import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setSpaceIds } from "../lib/api";

export interface Space {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface FooterPreference {
  id: string;
  key: string;
  value: Record<string, unknown>;
  updatedAt: string;
}

const FOOTER_SPACES_KEY = "spaces";
const PREFS_QUERY_KEY = ["footer-preferences"];
const SPACES_QUERY_KEY = ["spaces"];

/** null = all spaces (no filtering) — the default. Empty array also means all. */
function parseSelection(value: Record<string, unknown> | undefined): string[] | null {
  const ids = value?.selected;
  if (!Array.isArray(ids) || ids.every((id) => typeof id === "string") === false) return null;
  return ids.length > 0 ? (ids as string[]) : null;
}

interface SpaceContextValue {
  spaces: Space[];
  loading: boolean;
  /** Selected space ids; null = all spaces. */
  selected: string[] | null;
  allSelected: boolean;
  toggle: (id: string) => void;
  showAll: () => void;
  create: ReturnType<typeof useMutation<Space, Error, string>>;
  remove: ReturnType<typeof useMutation<void | unknown, Error, string>>;
}

const SpaceContext = createContext<SpaceContextValue | null>(null);

/**
 * Org spaces + the user's selection, mounted once at the app root. The
 * selection injects the `x-space-ids` header into every API call and is part
 * of the context value — consumers (query keys, effects) re-run the moment it
 * changes, so space-filtered lists refresh without a manual reload.
 */
export function SpaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const spaces = useQuery({
    queryKey: SPACES_QUERY_KEY,
    queryFn: () => api<Space[]>("/api/spaces"),
  });

  const preferences = useQuery({
    queryKey: PREFS_QUERY_KEY,
    queryFn: () => api<FooterPreference[]>("/api/footer-preferences"),
  });

  // Selection derives straight from the (optimistically updated) prefs query —
  // no state mirror, so a toggle re-renders with the new selection immediately.
  const selection = parseSelection(preferences.data?.find((p) => p.key === FOOTER_SPACES_KEY)?.value);

  // Keep the outgoing header in sync — every api() call picks this up.
  // Selected ids the org no longer owns are dropped silently.
  // Set SYNCHRONOUSLY during render (not in an effect): children's queries
  // refetch in child effects, which run BEFORE parent effects — an effect
  // here would send the refetch out with the stale header.
  const effective = useMemo(
    () => (selection?.filter((id) => spaces.data?.some((s) => s.id === id)) ?? null),
    [selection, spaces.data],
  );
  setSpaceIds(effective && effective.length > 0 ? effective : null);

  const save = useMutation({
    mutationFn: (ids: string[] | null) =>
      api<FooterPreference>(`/api/footer-preferences/${FOOTER_SPACES_KEY}`, {
        method: "PUT",
        body: JSON.stringify({ selected: ids ?? [] }),
      }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: PREFS_QUERY_KEY });
      const previous = queryClient.getQueryData<FooterPreference[]>(PREFS_QUERY_KEY);
      queryClient.setQueryData<FooterPreference[]>(PREFS_QUERY_KEY, (rows) => {
        const rest = (rows ?? []).filter((r) => r.key !== FOOTER_SPACES_KEY);
        return [...rest, { id: FOOTER_SPACES_KEY, key: FOOTER_SPACES_KEY, value: { selected: ids ?? [] }, updatedAt: new Date().toISOString() }];
      });
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(PREFS_QUERY_KEY, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: PREFS_QUERY_KEY }),
  });

  const create = useMutation({
    mutationFn: (name: string) => api<Space>("/api/spaces", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: SPACES_QUERY_KEY }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/spaces/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: SPACES_QUERY_KEY });
      if (selection?.includes(id)) {
        const next = selection.filter((sid) => sid !== id);
        save.mutate(next.length > 0 ? next : null);
      }
    },
  });

  const value: SpaceContextValue = {
    spaces: spaces.data ?? [],
    loading: spaces.isLoading,
    selected: effective && effective.length > 0 ? effective : null,
    allSelected: !effective || effective.length >= (spaces.data?.length ?? 0),
    toggle: (id) => {
      // All selected → clicking a space means "just this one"; unchecking the
      // last selected space returns to all; otherwise plain multi-toggle.
      if (!effective || effective.length === 0) {
        save.mutate([id]);
        return;
      }
      const current = effective;
      const next = current.includes(id) ? current.filter((sid) => sid !== id) : [...current, id];
      save.mutate(next.length === 0 ? null : next);
    },
    showAll: () => save.mutate(null),
    create,
    remove,
  };

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpaces() {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error("useSpaces must be used within SpaceProvider");
  return ctx;
}