import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toolkitClient, type Scope } from "./lib/toolkit-client.js";
import type { ToolkitData } from "./hooks/useToolkitData.js";
import { ScopePicker } from "./partials/ScopePicker.js";
import { Overlay, btnGhost, btnPrimary } from "./partials/ui.js";

/** Paste standard `{ "mcpServers": { … } }` JSON to bulk-register servers. */
export function ImportDialog({ data, onClose }: { data: ToolkitData; onClose: () => void }) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState<Scope>({ all: true, ids: [] });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { created: number; skipped: Array<{ name: string; reason: string }> }>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await toolkitClient.importMcp(text, scope);
      setResult({ created: r.created.length, skipped: r.skipped });
      await data.refreshMcp();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay title="Import MCP servers" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-[12px] text-ink-muted">
          Paste the standard <code className="font-mono">{`{ "mcpServers": { … } }`}</code> JSON (VS Code / Claude Desktop / Cursor). stdio entries are skipped.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={`{\n  "mcpServers": {\n    "example": { "type": "http", "url": "https://mcp.example.com/mcp" }\n  }\n}`}
          className="w-full rounded-md bg-surface-muted px-3 py-2 font-mono text-[12px] outline-none focus:ring-1 focus:ring-outline-strong"
        />
        <ScopePicker spaces={data.spaces} value={scope} onChange={setScope} />
        {err ? <p className="text-[12px] text-destructive">{err}</p> : null}
        {result ? (
          <p className="text-[12px] text-ink-muted">
            Imported {result.created} server{result.created === 1 ? "" : "s"}
            {result.skipped.length ? ` · skipped ${result.skipped.length} (${result.skipped.map((s) => `${s.name}: ${s.reason}`).join("; ")})` : ""}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Close</button>
          <button type="button" disabled={!text.trim() || busy} onClick={() => void run()} className={btnPrimary}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Import
          </button>
        </div>
      </div>
    </Overlay>
  );
}
