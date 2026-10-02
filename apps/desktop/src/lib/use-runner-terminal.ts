import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { OLDWORLD_XTERM } from "@/lib/palette";
import "@xterm/xterm/css/xterm.css";

interface TerminalMessage {
  type: string;
  data?: string;
  code?: number;
  message?: string;
}

export interface RunnerTerminalOptions {
  cwd?: string | null;
  tmuxName?: string | null;
}

export function useRunnerTerminal(runnerId: string | null, opts: RunnerTerminalOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [generation, setGeneration] = useState(0);
  const [dead, setDead] = useState(false);
  const { cwd, tmuxName } = opts;

  useEffect(() => {
    const container = containerRef.current;
    if (!runnerId || !container) return;

    setDead(false);
    let disposed = false;

    const term = new Terminal({ convertEol: true, fontSize: 13, theme: OLDWORLD_XTERM });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();
    term.focus();

    const focusTerm = () => term.focus();
    container.addEventListener("click", focusTerm);

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/api/terminal`);

    ws.onopen = () => {
      const open: Record<string, unknown> = { type: "open", runnerId, cols: term.cols, rows: term.rows };
      if (cwd) open.cwd = cwd;
      if (tmuxName) open.tmuxName = tmuxName;
      ws.send(JSON.stringify(open));
    };

    ws.onmessage = (event) => {
      let msg: TerminalMessage;
      try {
        msg = JSON.parse(event.data as string) as TerminalMessage;
      } catch {
        return;
      }
      if (msg.type === "output") term.write(msg.data ?? "");
      else if (msg.type === "exit") {
        term.write(`\r\n[process exited with code ${msg.code}]\r\n`);
        if (!disposed) setDead(true);
      } else if (msg.type === "error") term.write(`\r\n[${msg.message}]\r\n`);
    };

    ws.onclose = () => {
      if (disposed) return;
      term.write("\r\n[disconnected]\r\n");
      setDead(true);
    };

    const dataSub = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    const ro = new ResizeObserver(() => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    });
    ro.observe(container);

    return () => {
      disposed = true;
      container.removeEventListener("click", focusTerm);
      ro.disconnect();
      dataSub.dispose();
      ws.close();
      term.dispose();
    };
  }, [runnerId, cwd, tmuxName, generation]);

  const restart = useCallback(() => setGeneration((g) => g + 1), []);

  return { containerRef, dead, restart };
}
