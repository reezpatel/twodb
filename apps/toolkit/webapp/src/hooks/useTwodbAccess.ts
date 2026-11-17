import { useCallback, useEffect, useMemo, useState } from "react";
import { toolkitClient, type TwodbScopeType, type TwodbTool } from "../lib/toolkit-client.js";

/**
 * Business hook for the TwoDB tools page: the fixed catalog (loaded once), the picked scope (a space or an agent), and
 * that scope's allow-list as an editable draft. Default is none; `save` replaces the scope's list on the server.
 */
export function useTwodbAccess() {
  const [catalog, setCatalog] = useState<TwodbTool[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [scopeType, setScopeType] = useState<TwodbScopeType>("space");
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [loadingScope, setLoadingScope] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCounts = useCallback(async () => {
    const rows = await toolkitClient.listTwodbAccess().catch(() => []);
    setCounts(Object.fromEntries(rows.map((r) => [`${r.scopeType}:${r.scopeId}`, r.count])));
  }, []);

  useEffect(() => {
    toolkitClient.listTwodbTools().then(setCatalog).catch((e: Error) => setCatalogError(e.message));
    void refreshCounts();
  }, [refreshCounts]);

  // Load the picked scope's list into both `saved` and the draft.
  useEffect(() => {
    if (!scopeId) {
      setSaved(new Set());
      setDraft(new Set());
      return;
    }
    let cancelled = false;
    setLoadingScope(true);
    setError(null);
    toolkitClient.getTwodbAccess(scopeType, scopeId)
      .then((r) => {
        if (cancelled) return;
        setSaved(new Set(r.tools));
        setDraft(new Set(r.tools));
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingScope(false));
    return () => {
      cancelled = true;
    };
  }, [scopeType, scopeId]);

  const dirty = useMemo(() => draft.size !== saved.size || [...draft].some((k) => !saved.has(k)), [draft, saved]);

  const toggle = useCallback((keys: string[], on: boolean) => {
    setDraft((d) => {
      const next = new Set(d);
      for (const k of keys) (on ? next.add(k) : next.delete(k));
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    if (!scopeId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await toolkitClient.setTwodbAccess(scopeType, scopeId, [...draft]);
      setSaved(new Set(res.tools));
      setDraft(new Set(res.tools));
      await refreshCounts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [scopeType, scopeId, draft, refreshCounts]);

  const discard = useCallback(() => setDraft(new Set(saved)), [saved]);

  return { catalog, catalogError, counts, scopeType, setScopeType, scopeId, setScopeId, draft, dirty, loadingScope, saving, error, toggle, save, discard };
}
