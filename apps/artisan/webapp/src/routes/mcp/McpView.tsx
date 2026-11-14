import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button, Checkbox } from "@twodb/blocks";
import { artisanClient, type AgentInfo, type DirectoryInfo, type McpScope, type McpServerInfo, type McpTransport, type SpaceInfo } from "../../lib/artisan-client.js";
import { cn } from "../../lib/cn.js";
import { InlineEdit } from "../../components/ui/inline-edit.js";
import { AvailabilityPicker, modeLabel, scopeSummary, scopeValid } from "../skills/partials/AvailabilityPicker.js";
import { HeadersEditor, headersOf, rowsOf, type HeaderRow } from "./partials/HeadersEditor.js";
import { TransportPicker } from "./partials/TransportPicker.js";

type McpTab = "connection" | "availability";
const TABS: Array<{ id: McpTab; label: string }> = [
  { id: "connection", label: "Connection" },
  { id: "availability", label: "Availability" },
];

/** MCP server page: name over Connection (url, transport, headers, enabled) / Availability tabs. Config only for now. */
export function McpView({ serverId, agents, directories, onChanged }: { serverId: string; agents: AgentInfo[]; directories: DirectoryInfo[]; onChanged: () => void | Promise<void> }) {
  const [server, setServer] = useState<McpServerInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<McpTab>("connection");
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);

  useEffect(() => {
    setServer(null);
    setError(null);
    setTab("connection");
    artisanClient.getMcpServer(serverId).then(setServer).catch((e: Error) => setError(e.message));
  }, [serverId]);
  useEffect(() => {
    artisanClient.listSpaces().then(setSpaces).catch(() => setSpaces([]));
  }, []);

  const save = useCallback(
    async (patch: Parameters<typeof artisanClient.updateMcpServer>[1]) => {
      const next = await artisanClient.updateMcpServer(serverId, patch);
      setServer(next);
      void onChanged();
    },
    [serverId, onChanged],
  );

  if (error) return <p className="p-6 text-[13px] text-destructive">{error}</p>;
  if (!server) return <div className="flex flex-1 items-center justify-center text-ink-muted"><Loader2 className="size-5 animate-spin" /></div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-6 pt-5">
        <div className="flex items-center gap-2">
          <InlineEdit value={server.name} placeholder="server-name" required onSave={(name) => save({ name })} className="font-mono text-[18px] font-semibold" />
          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-ink-muted" title="Availability">
            {modeLabel(server.scope.mode)} · {scopeSummary(server.scope, { agents, spaces, directories })}
          </span>
          {!server.enabled ? <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-warning">disabled</span> : null}
        </div>
        <p className="mt-0.5 truncate font-mono text-[12px] text-ink-muted">{server.url}</p>
        <div className="mt-4 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] transition-colors", tab === t.id ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="-mt-px h-px bg-outline/60" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "connection" ? <ConnectionTab key={server.updatedAt} server={server} onSave={save} /> : null}
        {tab === "availability" ? <AvailabilityTab key={server.id} server={server} agents={agents} spaces={spaces} directories={directories} onSave={(scope) => save({ scope })} /> : null}
      </div>
    </div>
  );
}

function ConnectionTab({ server, onSave }: { server: McpServerInfo; onSave: (p: { url?: string; transport?: McpTransport; headers?: Record<string, string>; enabled?: boolean }) => Promise<void> }) {
  const [url, setUrl] = useState(server.url);
  const [transport, setTransport] = useState<McpTransport>(server.transport);
  const [rows, setRows] = useState<HeaderRow[]>(rowsOf(server.headers));
  const [enabled, setEnabled] = useState(server.enabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const headers = headersOf(rows);
  const dirty = url.trim() !== server.url || transport !== server.transport || enabled !== server.enabled || JSON.stringify(headers) !== JSON.stringify(server.headers);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSave({ url: url.trim(), transport, headers, enabled });
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-5">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-[12px] text-ink-muted">
          Stored configuration. Servers are not connected or offered to agents yet — tools will appear as <code className="font-mono">mcp__{server.name}__&lt;tool&gt;</code>.
        </p>
        {err ? <span className="text-[12px] text-destructive">{err}</span> : null}
        <Button size="sm" variant="primary" disabled={!dirty || !url.trim() || busy} onClick={() => void save()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : flash ? <Check className="size-3.5" /> : null} {flash ? "Saved" : "Save changes"}
        </Button>
      </div>

      <Field label="URL">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" className="h-9 w-full rounded-md bg-surface-muted px-2.5 font-mono text-[13px] outline-none focus:ring-1 focus:ring-outline-strong" />
      </Field>
      <Field label="Transport">
        <TransportPicker value={transport} onChange={setTransport} />
      </Field>
      <Field label="Headers" hint="Sent with every request. Use <ENV_NAME> in a value to read it from the server's environment instead of storing a secret.">
        <HeadersEditor rows={rows} onChange={setRows} />
      </Field>
      <label className="flex items-center gap-2 text-[13px] text-ink">
        <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
        Enabled
        <span className="text-[12px] text-ink-muted">— disabled servers are never offered to agents</span>
      </label>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-ink">{label}</span>
      {children}
      {hint ? <p className="text-[11px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function AvailabilityTab({ server, agents, spaces, directories, onSave }: { server: McpServerInfo; agents: AgentInfo[]; spaces: SpaceInfo[]; directories: DirectoryInfo[]; onSave: (s: McpScope) => Promise<void> }) {
  const [scope, setScope] = useState<McpScope>(server.scope);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const norm = (s: McpScope) => JSON.stringify({ ...s, ids: [...s.ids].sort() });
  const same = norm(scope) === norm(server.scope);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSave(scope);
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-5">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-[12px] text-ink-muted">Decides which agents this server's tools will be offered to.</p>
        {err ? <span className="text-[12px] text-destructive">{err}</span> : null}
        <Button size="sm" variant="primary" disabled={same || !scopeValid(scope) || busy} onClick={() => void save()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : flash ? <Check className="size-3.5" /> : null} {flash ? "Saved" : "Save changes"}
        </Button>
      </div>
      <AvailabilityPicker scope={scope} onChange={setScope} agents={agents} spaces={spaces} directories={directories} />
    </div>
  );
}
