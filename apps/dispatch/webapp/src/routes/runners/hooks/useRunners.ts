import { useCallback, useEffect, useState } from "react";
import { dispatchClient, type Runner } from "../../../lib/dispatch-client.js";

/**
 * Business hook: the runner list + mutations. The once-only key from
 * createRunner is surfaced for the dialog to show exactly once.
 */
export function useRunners() {
  const [runners, setRunners] = useState<Runner[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRunners(await dispatchClient.listRunners());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Runner status flips when sockets come and go — poll gently.
    const t = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  const create = useCallback(
    async (input: { name?: string; kind?: "host" | "microvm-host" }) => {
      setBusy(true);
      try {
        const res = await dispatchClient.createRunner(input);
        await refresh();
        return res;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (name: string) => {
      setBusy(true);
      try {
        await dispatchClient.deleteRunner(name);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { runners, busy, error, refresh, create, remove };
}
