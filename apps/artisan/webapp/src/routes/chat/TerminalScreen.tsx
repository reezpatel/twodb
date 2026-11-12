import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { useSessionConsole } from "./hooks/useSessionSide.js";

/** One-shot console (terminal tab): command history, ↑ recall, cwd = session dir. */
export function TerminalScreen(props: { sessionId: string }) {
  const console_ = useSessionConsole(props.sessionId);
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [console_.history.length]);

  const submit = () => {
    const command = input.trim();
    if (!command || console_.busy) return;
    setInput("");
    void console_.run(command);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px]">
        {console_.history.length === 0 ? <p className="text-ink-muted">Commands run in the session directory.</p> : null}
        {console_.history.map((h, i) => (
          <div key={i} className="mb-2">
            <p className="text-ink">
              <span className="text-success">$</span> {h.command}
            </p>
            {h.stdout ? <pre className="whitespace-pre-wrap text-ink-muted">{h.stdout}</pre> : null}
            {h.stderr ? <pre className="whitespace-pre-wrap text-destructive">{h.stderr}</pre> : null}
            {h.exitCode ? <p className="text-[10px] text-destructive">exit {h.exitCode}</p> : null}
          </div>
        ))}
        {console_.busy ? <p className="text-ink-muted"><RotateCw className="mr-1 inline size-3 animate-spin" />running…</p> : null}
      </div>
      <div className="flex items-center gap-2 border-t border-outline px-3 py-2 font-mono text-[12px]">
        <span className="text-success">$</span>
        <input
          value={input}
          className="flex-1 bg-transparent outline-none"
          placeholder="command…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "ArrowUp") {
              const last = console_.history[console_.history.length - 1];
              if (last) setInput(last.command);
            }
          }}
        />
      </div>
    </div>
  );
}
