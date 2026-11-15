import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toolkitClient, type McpServer, type McpTransport, type Scope } from "./lib/toolkit-client.js";
import type { ToolkitData } from "./hooks/useToolkitData.js";
import { ScopePicker } from "./partials/ScopePicker.js";
import { AgentAccessPicker } from "./partials/AgentAccessPicker.js";
import { Overlay, btnGhost, btnPrimary, inputCls, labelCls } from "./partials/ui.js";

const TRANSPORTS: McpTransport[] = ["auto", "http", "sse"];

/** Add/edit dialog for an MCP server (name, url, transport, headers, scope). */
export function McpDialog({ data, initial, onClose }: { data: ToolkitData; initial: McpServer | null; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [transport, setTransport] = useState<McpTransport>(initial?.transport ?? "auto");
  const [headerRows, setHeaderRows] = useState<Array<{ k: string; v: string }>>(
    Object.entries(initial?.headers ?? {}).map(([k, v]) => ({ k, v: String(v) })),
  );
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [scope, setScope] = useState<Scope>(initial?.scope ?? { all: true, ids: [] });
  const [agentIds, setAgentIds] = useState<string[]>(initial?.agentIds ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setErr(null), [name, url, transport, headerRows, scope]);

  const headers = Object.fromEntries(headerRows.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v]));

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (initial) {
        await toolkitClient.updateMcp(initial.id, { name: name.trim(), url: url.trim(), transport, headers, enabled, scope, agentIds });
      } else {
        await toolkitClient.createMcp({ name: name.trim(), url: url.trim(), transport, headers, enabled, scope, agentIds });
      }
      await data.refreshMcp();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay title={initial ? `Edit ${initial.name}` : "Add MCP server"} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <label className={labelCls}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-server" className={`${inputCls} mt-1 font-mono`} />
        </div>
        <div>
          <label className={labelCls}>URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" className={`${inputCls} mt-1 font-mono`} />
        </div>
        <div>
          <label className={labelCls}>Transport</label>
          <div className="mt-1 flex gap-1">
            {TRANSPORTS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTransport(t)}
                className={`rounded-md border px-3 py-1.5 font-mono text-[12px] transition-colors ${
                  transport === t ? "border-accent bg-accent/10 text-accent-foreground" : "border-outline/60 text-ink-muted hover:border-outline-strong hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Headers</label>
          <div className="mt-1 flex flex-col gap-1.5">
            {headerRows.map((row, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  value={row.k}
                  onChange={(e) => setHeaderRows(headerRows.map((r, j) => (i === j ? { ...r, k: e.target.value } : r)))}
                  placeholder="Authorization"
                  className={`${inputCls} font-mono`}
                />
                <input
                  value={row.v}
                  onChange={(e) => setHeaderRows(headerRows.map((r, j) => (i === j ? { ...r, v: e.target.value } : r)))}
                  placeholder="Bearer …"
                  className={`${inputCls} font-mono`}
                />
                <button type="button" onClick={() => setHeaderRows(headerRows.filter((_, j) => j !== i))} className="rounded px-2 text-ink-muted hover:text-destructive" aria-label="Remove header">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setHeaderRows([...headerRows, { k: "", v: "" }])} className="self-start text-[12px] text-accent-foreground hover:underline">
              + header
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>Spaces</label>
          <div className="mt-1.5">
            <ScopePicker spaces={data.spaces} value={scope} onChange={setScope} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Agent access</label>
          <div className="mt-1.5">
            <AgentAccessPicker agents={data.agents} value={agentIds} onChange={setAgentIds} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-accent" />
          Enabled
        </label>
        {err ? <p className="text-[12px] text-destructive">{err}</p> : null}
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="button" disabled={busy || !name.trim() || !url.trim()} onClick={() => void save()} className={btnPrimary}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} {initial ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
