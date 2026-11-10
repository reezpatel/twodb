import { useCallback, useEffect, useState } from "react";
import {
  controlPlaneClient,
  tworouteClient,
  type Connection,
  type ProviderSpec,
  type QuotaSnapshot,
  type CachedModel,
  type UsageTotals,
} from "../../../lib/tworoute-client.js";

export interface Space {
  id: string;
  name: string;
}

export interface TestResult {
  connectionId: string;
  ok: boolean;
  detail: string;
}

/** Business hook: catalog + spaces + connections + create/patch/delete/test/
 * models/quotas/usage + OAuth polling. All state, no JSX. */
export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providers, setProviders] = useState<ProviderSpec[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult>>({});
  /** id → cached models (fetched lazily on expand). */
  const [models, setModels] = useState<Record<string, CachedModel[]>>({});
  /** id → quota snapshots. */
  const [quotas, setQuotas] = useState<QuotaSnapshot[]>([]);
  /** id → usage totals. */
  const [usage, setUsage] = useState<Record<string, UsageTotals>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [conns, provs, { spaces: sp }, { quotas: qs }] = await Promise.all([
        tworouteClient.listConnections(),
        tworouteClient.listProviders(),
        controlPlaneClient.listSpaces().catch(() => ({ spaces: [] as Space[] })),
        tworouteClient.listQuotas().catch(() => ({ quotas: [] as QuotaSnapshot[] })),
      ]);
      setConnections(conns);
      setProviders(provs);
      setSpaces(sp);
      setQuotas(qs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const spaceName = useCallback((id: string) => spaces.find((s) => s.id === id)?.name ?? id, [spaces]);
  const providerLabel = useCallback(
    (id: string) => providers.find((p) => p.id === id)?.label ?? id,
    [providers],
  );

  const create = useCallback(
    async (input: { spaceId: string; name: string; provider: string; baseUrl?: string; apiKey?: string; defaultModel?: string; config?: Record<string, string> }) => {
      setBusy(true);
      setError(null);
      try {
        await tworouteClient.createConnection(input);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const patch = useCallback(
    async (id: string, patch: Parameters<typeof tworouteClient.patchConnection>[1]) => {
      setBusy(true);
      setError(null);
      try {
        await tworouteClient.patchConnection(id, patch);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await tworouteClient.deleteConnection(id);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const test = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await tworouteClient.testConnection(id);
      setTests((t) => ({
        ...t,
        [id]: { connectionId: id, ok: true, detail: `ok via ${result.via}${result.modelCount ? ` (${result.modelCount} models)` : ""}` },
      }));
    } catch (err) {
      setTests((t) => ({ ...t, [id]: { connectionId: id, ok: false, detail: err instanceof Error ? err.message : String(err) } }));
    } finally {
      setBusy(false);
    }
  }, []);

  const loadModels = useCallback(async (id: string) => {
    try {
      const { models: m } = await tworouteClient.listModels(id);
      setModels((prev) => ({ ...prev, [id]: m }));
      // Lazily pull usage totals alongside.
      tworouteClient
        .usageTotals(id)
        .then((totals) => setUsage((prev) => ({ ...prev, [id]: totals })))
        .catch(() => {});
    } catch (err) {
      setTests((t) => ({ ...t, [id]: { connectionId: id, ok: false, detail: err instanceof Error ? err.message : String(err) } }));
    }
  }, []);

  const refreshModelsFor = useCallback(async (id: string) => {
    setBusy(true);
    try {
      await tworouteClient.refreshModels(id);
      await loadModels(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [loadModels]);

  const refreshQuotasFor = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await tworouteClient.refreshQuotas(id);
        const { quotas: qs } = await tworouteClient.listQuotas();
        setQuotas(qs);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /** One sweep across every supported connection — dead credentials fail
   * per-connection without failing the batch. Returns the result summary
   * (or null on a transport error). */
  const refreshAllQuotas = useCallback(async () => {
    setBusy(true);
    try {
      const result = await tworouteClient.refreshAllQuotas();
      setQuotas(result.quotas);
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Runs an OAuth flow: opens the provider's authorize URL, polls until the
   * callback delivers tokens, then resolves with them so the caller can save
   * them on the connection form. Returns null if the flow failed/was abandoned.
   */
  const runOauth = useCallback(async (provider: "claude-code" | "codex") => {
    const { url, state } = await tworouteClient.oauthStart(provider);
    window.open(url, "_blank");
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const result = await tworouteClient.oauthPoll(provider, state);
      if (result.status === "done") return result as { accessToken: string; refreshToken: string; accountId?: string | null };
      if (result.status === "error") throw new Error(String(result.error ?? "OAuth failed"));
    }
    return null;
  }, []);

  return {
    connections,
    providers,
    spaces,
    loading,
    busy,
    error,
    tests,
    models,
    quotas,
    usage,
    spaceName,
    providerLabel,
    create,
    patch,
    remove,
    test,
    loadModels,
    refreshModelsFor,
    refreshQuotasFor,
    refreshAllQuotas,
    runOauth,
    refresh,
  };
}
