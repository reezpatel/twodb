import { useCallback, useEffect, useState } from "react";
import { artisanClient, type QuotaConnection, type QuotaSnapshot } from "../../../lib/artisan-client.js";

/**
 * Provider usage quotas for the sidebar's Provider section. Snapshots come
 * from TwoRoute via the artisan server (GET /api/quotas) — the same source
 * as TwoRoute's own "Quotas by connection" dashboard widget.
 */
export function useProviderQuota(enabled = true) {
  const [connections, setConnections] = useState<QuotaConnection[]>([]);
  const [quotas, setQuotas] = useState<QuotaSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await artisanClient.providerQuotas();
      setConnections(data.connections);
      setQuotas(data.quotas);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [enabled, refresh]);

  return { connections, quotas, error, refresh };
}

