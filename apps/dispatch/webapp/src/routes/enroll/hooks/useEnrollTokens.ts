import { useCallback, useEffect, useState } from "react";
import { dispatchClient, type EnrollToken } from "../../../lib/dispatch-client.js";

/** Business hook: enrollment tokens (shared machine-join credentials). */
export function useEnrollTokens() {
  const [tokens, setTokens] = useState<EnrollToken[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTokens(await dispatchClient.listEnrollTokens());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: { name?: string; expiresInDays?: number }) => {
      setBusy(true);
      try {
        const res = await dispatchClient.createEnrollToken(input);
        await refresh();
        return res;
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
        await dispatchClient.deleteEnrollToken(id);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { tokens, busy, error, refresh, create, remove };
}
