import { useCallback, useEffect, useRef, useState } from "react";
import { gatewayClient, type ApiKeyMeta } from "../../../lib/gateway-client.js";

/**
 * Business hook for the API-keys view: list/create/revoke the workspace's
 * gateway keys (the ones x-api-key auth verifies). The raw key of a
 * freshly-created key is held only until dismissed — the server never
 * returns it again. Also owns the small interaction state the view needs:
 * inline revoke confirmation, secret reveal and copy feedback.
 */
export function useApiKeys() {
  const [keys, setKeys] = useState<ApiKeyMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The one-time raw key of the just-created key — null once dismissed. */
  const [freshRawKey, setFreshRawKey] = useState<string | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  /** Id of the key whose inline "Cancel / Confirm" revoke prompt is open. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, [refresh]);

  const create = useCallback(
    async (name: string) => {
      setBusy(true);
      setError(null);
      try {
        const { rawKey } = await gatewayClient.createApiKey(name);
        setFreshRawKey(rawKey);
        setSecretVisible(false);
        setCopied(false);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const revoke = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await gatewayClient.revokeApiKey(id);
        setConfirmingId(null);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const copySecret = useCallback(async () => {
    if (!freshRawKey) return;
    await navigator.clipboard?.writeText(freshRawKey);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  }, [freshRawKey]);

  return {
    keys,
    loading,
    busy,
    error,
    freshRawKey,
    dismissRawKey: () => setFreshRawKey(null),
    secretVisible,
    toggleSecretVisible: () => setSecretVisible((v) => !v),
    copied,
    copySecret,
    confirmingId,
    startRevoke: (id: string) => setConfirmingId(id),
    cancelRevoke: () => setConfirmingId(null),
    create,
    revoke,
    refresh,
  };
}
