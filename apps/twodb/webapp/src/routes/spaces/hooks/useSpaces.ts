import { useCallback, useEffect, useRef, useState } from "react";
import { gatewayClient, type SpaceMeta } from "../../../lib/gateway-client.js";

/** Business hook for the Spaces view: list + create the workspace's spaces, and copy-id feedback. */
export function useSpaces() {
  const [spaces, setSpaces] = useState<SpaceMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Id of the space whose id was just copied (drives the "Copied" feedback). */
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
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

  const copyId = useCallback(async (id: string) => {
    await navigator.clipboard?.writeText(id);
    setCopiedId(id);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 1500);
  }, []);

  return { spaces, loading, busy, error, create, refresh, copiedId, copyId };
}
