import { useCallback, useEffect, useRef, useState } from "react";
import { dispatchClient, type ExecResult, type Microvm } from "../../../lib/dispatch-client.js";

/**
 * Business hook for the microvm detail page: the VM record, the exec
 * console, and the raw terminal relay (WebSocket carrying base64 frames).
 */
export function useVmDetail(identifier: string) {
  const [vm, setVm] = useState<Microvm | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await dispatchClient.listMicrovms();
      setVm(all.find((v) => v.identifier === identifier) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [identifier]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5_000);
    return () => clearInterval(t);
  }, [load]);

  return { vm, error, reload: load, identifier };
}

/** The exec console state: run a command in the VM, collect output lines. */
export function useVmConsole(runnerName: string | null, identifier: string) {
  const [entries, setEntries] = useState<{ command: string; result: ExecResult | null; error: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [cwd, setCwd] = useState("/app");

  const run = useCallback(
    async (command: string) => {
      if (!runnerName) return;
      setEntries((prev) => [...prev, { command, result: null, error: null }]);
      setBusy(true);
      try {
        const result = await dispatchClient.vmExec({ runnerId: runnerName, identifier, command, cwd: cwd.trim() || undefined });
        setEntries((prev) => prev.map((e, i) => (i === prev.length - 1 ? { ...e, result } : e)));
      } catch (e) {
        setEntries((prev) => prev.map((en, i) => (i === prev.length - 1 ? { ...en, error: (e as Error).message } : en)));
      } finally {
        setBusy(false);
      }
    },
    [runnerName, identifier],
  );

  return { entries, busy, run, cwd, setCwd };
}

/** Terminal relay: a WebSocket streaming base64 frames both ways. Returns
 *  the terminal text, a send function, and connect state. */
export function useVmTerminal(identifier: string, enabled: boolean) {
  const [connected, setConnected] = useState(false);
  const [text, setText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setText("");
    let closed = false;
    const ws = new WebSocket(dispatchClient.vmStreamUrl(identifier, "terminal"));
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => {
      // Relay frames are base64 text from the guest pty.
      try {
        const decoded = atob(String(ev.data));
        setText((t) => (t + decoded).slice(-16_000));
      } catch {
        setText((t) => (t + String(ev.data)).slice(-16_000));
      }
    };
    return () => {
      closed = true;
      void closed;
      ws.close();
    };
  }, [identifier, enabled]);

  const send = useCallback((data: string) => {
    wsRef.current?.send(btoa(data));
  }, []);

  return { connected, text, send };
}
