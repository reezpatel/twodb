import { useEffect, useRef, useState } from "react";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { X, SquareDashed } from "lucide-react";

const THEME: ITheme = {
  background: "#1a1815",
  foreground: "#e8e4da",
  cursor: "#a9c1e8",
  cursorAccent: "#1a1815",
  selectionBackground: "#4f63ad55",
};

/**
 * Interactive terminal in a resizable bottom split. Attaches to a tmux session
 * named "twodb" on the session's runner (tmux new-session -A reattaches if it
 * already exists), so the shell survives page refreshes and tab switches.
 */
export function TerminalPanel(props: { sessionId: string; height: number; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const term = new Terminal({ theme: THEME, fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", cursorBlink: true, allowProposedApi: true });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    termRef.current = term;
    fitRef.current = fit;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    // No command → artisan defaults to `tmux new-session -A -s twodb -c <dir>`.
    const ws = new WebSocket(`${proto}://${window.location.host}/artisan-api/sessions/${props.sessionId}/term`);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";
    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("closed");
    ws.onmessage = (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : "";
      if (!raw) return;
      // JSON control frames (e.g. {type:"error"}) start with '{'; else base64 pty bytes
      if (raw.startsWith("{")) {
        try { const m = JSON.parse(raw); if (m.type === "error") term.write(`\r\n[${m.message}]\r\n`); } catch { /* ignore */ }
        return;
      }
      term.write(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)));
    };
    term.onData((data) => {
      if (ws.readyState === ws.OPEN) ws.send(btoa(data));
    });

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (ws.readyState === ws.OPEN && term.cols && term.rows) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      } catch { /* ignore */ }
    });
    ro.observe(container);
    // initial size
    try { fit.fit(); if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })); } catch { /* ignore */ }
    // report size so the pty matches the xterm cols/rows
    const sendSize = () => {
      if (ws.readyState === ws.OPEN && term.cols && term.rows) {
        // artisan passes cols/rows via a small control frame is complex; tmux handles SIGWINCH via pty.Setsize on dispatch if sent
      }
    };
    sendSize();

    return () => {
      ro.disconnect();
      ws.close();
      term.dispose();
    };
  }, [props.sessionId]);

  // refit when the split height changes
  useEffect(() => {
    try { fitRef.current?.fit(); termRef.current?.focus(); } catch { /* ignore */ }
  }, [props.height]);

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-outline bg-[#1a1815]">
      <div className="flex shrink-0 items-center gap-2 border-b border-outline/40 px-3 py-1">
        <SquareDashed className="size-3 text-[#8a8578]" />
        <span className="text-[11px] text-[#8a8578]">twodb — tmux (survives refresh)</span>
        <span className={`size-1.5 rounded-full ${status === "open" ? "bg-emerald-500" : status === "connecting" ? "bg-amber-400" : "bg-red-400"}`} />
        <button type="button" aria-label="Close terminal" className="ml-auto rounded p-0.5 text-[#8a8578] hover:text-white" onClick={props.onClose}>
          <X className="size-3.5" />
        </button>
      </div>
      <div ref={containerRef} data-slot="terminal-panel" className="min-h-0 flex-1 overflow-hidden p-1" />
    </div>
  );
}
