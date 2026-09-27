import { useEffect, useRef } from "react";
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

export function useRunnerTerminal(runnerId: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({ convertEol: true, fontSize: 13, theme: OLDWORLD_XTERM });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/api/terminal`);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "open",
          runnerId,
          cols: term.cols,
          rows: term.rows,
        }),
      );
    };

    ws.onmessage = (event) => {
      let msg: TerminalMessage;
      try {
        msg = JSON.parse(event.data as string) as TerminalMessage;
      } catch {
        return;
      }
      if (msg.type === "output") term.write(msg.data ?? "");
      else if (msg.type === "exit") term.write(`\r\n[process exited with code ${msg.code}]\r\n`);
      else if (msg.type === "error") term.write(`\r\n[${msg.message}]\r\n`);
    };

    ws.onclose = () => term.write("\r\n[disconnected]\r\n");

    const dataSub = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    const onResize = () => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      dataSub.dispose();
      ws.close();
      term.dispose();
    };
  }, [runnerId]);

  return containerRef;
}
