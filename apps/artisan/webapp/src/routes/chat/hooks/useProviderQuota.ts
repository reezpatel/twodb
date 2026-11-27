import { useMemo } from "react";
import { connectionForModel, useProviderQuotas } from "../../../lib/provider-quota.js";

/**
 * The session model's provider quotas, picked from the global quota state —
 * no per-session network call (see ProviderQuotaProvider).
 */
export function useProviderQuota(model: string | null | undefined) {
  const { connections, quotas, error, refresh } = useProviderQuotas();
  return useMemo(() => {
    if (!model) return { connections: [], quotas: [], error, refresh };
    const id = connectionForModel(model, connections);
    if (!id) return { connections: [], quotas: [], error, refresh };
    return { connections: connections.filter((c) => c.id === id), quotas: quotas.filter((q) => q.connectionId === id), error, refresh };
  }, [model, connections, quotas, error, refresh]);
}
