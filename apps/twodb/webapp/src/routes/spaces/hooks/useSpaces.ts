import { useCallback, useEffect, useState } from "react";
import { gatewayClient, type SpaceMeta } from "../../../lib/gateway-client.js";

/** Business hook for the Spaces view: list + create the workspace's spaces. */
export function useSpaces() {
  const [spaces, setSpaces] = useState<SpaceMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { spaces } = await gatewayClient.listSpaces();
      setSpaces(spaces);
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

  const create = useCallback(
    async (name: string) => {
      setBusy(true);
      setError(null);
      try {
        await gatewayClient.createSpace(name);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { spaces, loading, busy, error, create, refresh };
}
