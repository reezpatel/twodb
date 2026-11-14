import { useEffect, useRef, useState } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { RotateCw, TerminalSquare } from "lucide-react";
import { apiWsUrl } from "../../lib/artisan-client.js";

const THEME: ITheme = {
  background: "#1a1815",
  foreground: "#e8e4da",
  cursor: "#a9c1e8",
  cursorAccent: "#1a1815",
  selectionBackground: "#4f63ad55",
};

/**
 * Full-screen interactive terminal (legacy terminal-screen parity). Attaches to
 * a tmux session named "twodb-<sessionId>" on the session's runner — tmux
 * reattaches on reconnect, so the shell survives refresh and tab switches.
 * Resize is forwarded to the pty so fullscreen apps (vim/htop) lay out right.
 */
export function TerminalScreen(props: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dead, setDead] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setDead(false);
    let disposed = false;

    const term = new Terminal({ convertEol: true, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", theme: THEME, cursorBlink: true, allowProposedApi: true });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();
    term.focus();
    const focusTerm = () => term.focus();
    container.addEventListener("click", focusTerm);

    let ws: WebSocket | null = null;
    let cleanupWs: (() => void) | null = null;
    void apiWsUrl(`/sessions/${props.sessionId}/term`).then((url) => {
      if (disposed) return;
      ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      cleanupWs = wireWs(ws);
    });

    function wireWs(sock: WebSocket): () => void {
      sock.onopen = () => {
        if (sock.readyState === sock.OPEN && term.cols && term.rows) {
          sock.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      };
      sock.onmessage = (ev) => {
        const raw = typeof ev.data === "string" ? ev.data : "";
        if (!raw) return;
        if (raw.startsWith("{")) {
          try {
            const m = JSON.parse(raw) as { type?: string; message?: string };
            if (m.type === "error") term.write(`\r\n[${m.message}]\r\n`);
          } catch { /* ignore */ }
          return;
        }
        term.write(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)));
      };
      sock.onclose = () => {
        if (disposed) return;
        term.write("\r\n[disconnected]\r\n");
        setDead(true);
      };
      sock.onerror = () => { /* onclose follows */ };

      const dataSub = term.onData((data) => {
        if (sock.readyState === sock.OPEN) sock.send(btoa(data));
      });
      const ro = new ResizeObserver(() => {
        try {
          fit.fit();
          if (sock.readyState === sock.OPEN && term.cols && term.rows) {
            sock.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
          }
        } catch { /* ignore */ }
      });
      ro.observe(container!);

      return () => {
        ro.disconnect();
        dataSub.dispose();
        try { sock.close(); } catch { /* ignore */ }
      };
    }

    return () => {
      disposed = true;
      container.removeEventListener("click", focusTerm);
      cleanupWs?.();
      term.dispose();
    };
  }, [props.sessionId, generation]);

  return (
    <div className="relative flex h-full min-h-0 flex-col p-2">
      <div ref={containerRef} data-slot="terminal-full" className="min-h-0 flex-1 overflow-hidden rounded-lg border border-outline bg-[#1a1815] p-2" />
      {dead ? (
        <button
          type="button"
          title="Restart terminal"
          onClick={() => setGeneration((g) => g + 1)}
          className="absolute bottom-4 right-4 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        >
          <RotateCw size={15} />
        </button>
      ) : null}
      <span className="sr-only"><TerminalSquare /> terminal</span>
    </div>
  );
}
