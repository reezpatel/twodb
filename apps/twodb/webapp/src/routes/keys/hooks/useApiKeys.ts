import { useCallback, useEffect, useState } from "react";
import { gatewayClient, type ApiKeyMeta } from "../../../lib/gateway-client.js";

/**
 * Business hook for the API-keys view: list/create/revoke the workspace's
 * gateway keys (the ones x-api-key auth verifies). The raw key of a
 * freshly-created key is held only until dismissed — the server never
 * returns it again.
 */
export function useApiKeys() {
  const [keys, setKeys] = useState<ApiKeyMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The one-time raw key of the just-created key — null once dismissed. */
  const [freshRawKey, setFreshRawKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { keys } = await gatewayClient.listApiKeys();
      setKeys(keys);
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

  const create = useCallback(async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      const { rawKey } = await gatewayClient.createApiKey(name);
      setFreshRawKey(rawKey);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const revoke = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await gatewayClient.revokeApiKey(id);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { keys, loading, busy, error, freshRawKey, dismissRawKey: () => setFreshRawKey(null), create, revoke, refresh };
}
