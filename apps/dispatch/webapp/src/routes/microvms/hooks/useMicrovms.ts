import { useCallback, useEffect, useState } from "react";
import { dispatchClient, type ExecResult, type Microvm } from "../../../lib/dispatch-client.js";

/** Business hook: the microvm list + boot/exec/shutdown. */
export function useMicrovms() {
  const [microvms, setMicrovms] = useState<Microvm[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setMicrovms(await dispatchClient.listMicrovms());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  const boot = useCallback(
    async (input: { runnerId?: string; identifier: string; memMb?: number; vcpu?: number; idleShutdownSec?: number }) => {
      setBusy(true);
      try {
        const vm = await dispatchClient.bootMicrovm(input);
        await refresh();
        return vm;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const shutdown = useCallback(
    async (identifier: string, archive: boolean) => {
      setBusy(true);
      try {
        await dispatchClient.shutdownMicrovm(identifier, archive);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const exec = useCallback(
    (input: { runnerId: string; identifier: string; command: string }) => dispatchClient.vmExec(input) as Promise<ExecResult>,
    [],
  );

  return { microvms, busy, error, refresh, boot, shutdown, exec };
}
