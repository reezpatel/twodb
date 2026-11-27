import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { artisanClient, type QuotaConnection, type QuotaSnapshot } from "./artisan-client.js";

/**
 * Workspace-wide provider quotas, fetched once and refreshed on an interval
 * (not per session). Each session just picks its connection from this state,
 * so switching sessions makes no network call.
 */
interface QuotaState {
  connections: QuotaConnection[];
  quotas: QuotaSnapshot[];
  error: string | null;
  loaded: boolean;
  refresh: () => Promise<void>;
}

const QuotaContext = createContext<QuotaState | null>(null);

export function ProviderQuotaProvider(props: { children: ReactNode }) {
  const [connections, setConnections] = useState<QuotaConnection[]>([]);
  const [quotas, setQuotas] = useState<QuotaSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await artisanClient.providerQuotas();
      setConnections(data.connections);
      setQuotas(data.quotas);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const value = useMemo(() => ({ connections, quotas, error, loaded, refresh }), [connections, quotas, error, loaded, refresh]);
  return <QuotaContext.Provider value={value}>{props.children}</QuotaContext.Provider>;
}

export function useProviderQuotas(): QuotaState {
  const ctx = useContext(QuotaContext);
  if (!ctx) throw new Error("useProviderQuotas must be used inside <ProviderQuotaProvider>");
  return ctx;
}

/** Connection id serving `modelId` — mirrors the server's QuotaClient.connectionForModel. */
export function connectionForModel(modelId: string, connections: QuotaConnection[]): string | null {
  const exact = connections.find((c) => modelId === c.id || modelId.startsWith(`${c.id}/`));
  if (exact) return exact.id;
  const prefix = modelId.split("/")[0]?.toLowerCase() ?? "";
  if (!prefix) return null;
  const byProvider = connections.filter((c) => c.provider.toLowerCase() === prefix || c.name.toLowerCase() === prefix);
  return byProvider.length === 1 ? byProvider[0].id : null;
}
