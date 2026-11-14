import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@twodb/blocks";
import { artisanClient, type AgentInfo, type DirectoryInfo, type McpImportPreview, type McpScope, type McpServerInfo, type McpTransport, type SpaceInfo } from "../../../lib/artisan-client.js";
import { cn } from "../../../lib/cn.js";
import { AvailabilityPicker, DEFAULT_SCOPE, scopeValid } from "../../skills/partials/AvailabilityPicker.js";
import { HeadersEditor, headersOf, type HeaderRow } from "./HeadersEditor.js";
import { TransportPicker } from "./TransportPicker.js";

const NAME_RE = /^[\w][\w-]*$/;
const PLACEHOLDER = `{
  "mcpServers": {
    "firecrawl": {
      "type": "http",
      "url": "https://mcp.firecrawl.dev/v2/mcp",
      "headers": { "Authorization": "Bearer <FIRECRAWL_API_KEY>" }
    }
  }
}`;

/** New MCP server: fill in one server, or paste an mcpServers JSON (VS Code / Claude Desktop / Cursor). */
export function McpDialog({ agents, directories, onClose, onCreated }: {
  agents: AgentInfo[];
  directories: DirectoryInfo[];
  onClose: () => void;
  /** Called with the created servers — the first one is opened. */
  onCreated: (servers: McpServerInfo[]) => Promise<void>;
}) {
  const [mode, setMode] = useState<"single" | "import">("single");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<McpTransport>("auto");
  const [rows, setRows] = useState<HeaderRow[]>([]);
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<McpImportPreview | null>(null);
  const [scope, setScope] = useState<McpScope>(DEFAULT_SCOPE);
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    artisanClient.listSpaces().then(setSpaces).catch(() => setSpaces([]));
  }, []);

  const nameOk = NAME_RE.test(name.trim());
  const valid = scopeValid(scope) && (mode === "single" ? nameOk && Boolean(url.trim()) : Boolean(preview?.drafts.length));

  const runPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await artisanClient.previewMcpImport(json));
    } catch (e) {
      setPreview(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "single") {
        const s = await artisanClient.createMcpServer({ name: name.trim(), url: url.trim(), transport, headers: headersOf(rows), scope });
        await onCreated([s]);
      } else {
        const res = await artisanClient.importMcpServers(json, scope);
        if (res.created.length === 0) throw new Error(res.conflicts.length ? `Already exist: ${res.conflicts.join(", ")}` : "Nothing was imported");
        await onCreated(res.created);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New MCP server</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-1">
          <div className="flex w-fit gap-1 rounded-[8px] bg-paper-grid/60 p-0.5">
            {([["single", "Single server"], ["import", "Import JSON"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => { setMode(id); setError(null); }} className={cn("h-7 rounded-[6px] px-3 text-[12px] transition-colors", mode === id ? "bg-stone text-ink" : "text-muted-foreground hover:text-ink")}>
                {label}
              </button>
            ))}
          </div>

          {mode === "single" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="firecrawl" className="font-mono" />
                <p className={cn("text-[11px]", name && !nameOk ? "text-destructive" : "text-ink-muted")}>Letters, digits, _ and -. Prefixes the tool names: mcp__{name.trim() || "name"}__&lt;tool&gt;.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" className="font-mono" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Transport</Label>
                <TransportPicker value={transport} onChange={setTransport} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Headers <span className="font-normal text-ink-muted">(optional — use &lt;ENV_NAME&gt; for secrets)</span></Label>
                <HeadersEditor rows={rows} onChange={setRows} />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <Label>mcpServers JSON</Label>
              <textarea
                value={json}
                onChange={(e) => { setJson(e.target.value); setPreview(null); setError(null); }}
                placeholder={PLACEHOLDER}
                spellCheck={false}
                className="min-h-44 resize-y rounded-md bg-surface-muted px-3 py-2 font-mono text-[12px] leading-snug outline-none focus:ring-1 focus:ring-outline-strong"
              />
              <div className="flex items-center gap-3">
                <Button size="sm" variant="ghost" disabled={!json.trim() || busy} onClick={() => void runPreview()}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Preview
                </Button>
                <p className="text-[11px] text-ink-muted">http/sse servers are imported; stdio entries are skipped.</p>
              </div>
              {preview ? (
                <div className="flex flex-col gap-0.5 text-[12px]">
                  {preview.drafts.map((d) => <p key={d.name} className="truncate text-success">✓ {d.name} — {d.url}</p>)}
                  {preview.skipped.map((s) => <p key={s.name} className="text-destructive">✗ {s.name} — {s.reason}</p>)}
                </div>
              ) : null}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>Available to{mode === "import" ? <span className="font-normal text-ink-muted"> (applies to every imported server)</span> : null}</Label>
            <AvailabilityPicker scope={scope} onChange={setScope} agents={agents} spaces={spaces} directories={directories} />
          </div>
        </div>
        {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void create()} disabled={!valid || busy}>
            {busy && mode === "single" ? <Loader2 className="size-3.5 animate-spin" /> : null} {mode === "single" ? "Create server" : `Import ${preview?.drafts.length ?? ""}`.trim()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
