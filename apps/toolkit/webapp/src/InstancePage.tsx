import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, HeartPulse, Loader2, Play, Plus, Radio, Trash2, Wrench } from "lucide-react";
import { toolkitClient, type BroadcastEvent, type ConnectorInstance, type QueueInfo, type Tool } from "./lib/toolkit-client.js";
import { cn } from "./lib/cn.js";
import type { ToolkitData } from "./hooks/useToolkitData.js";
import { ScopePicker } from "./partials/ScopePicker.js";
import { AgentAccessPicker } from "./partials/AgentAccessPicker.js";

type Section = "tools" | "settings" | "events" | "queues";
const SECTIONS: Array<{ id: Section; label: string; icon: React.ReactNode }> = [
  { id: "tools", label: "Tools", icon: <Wrench className="size-3.5" /> },
  { id: "events", label: "Broadcasts", icon: <Radio className="size-3.5" /> },
  { id: "queues", label: "Queues", icon: <Activity className="size-3.5" /> },
  { id: "settings", label: "Settings", icon: null },
];

/**
 * The connected-instance page: everything one instance offers — its tools
 * (invocable), recent broadcasts (live stream), requested queues, settings.
 * Shown in the main area when an instance is selected in the sidebar.
 */
export function InstancePage({ data, instance }: { data: ToolkitData; instance: ConnectorInstance }) {
  const [section, setSection] = useState<Section>("tools");
  const [full, setFull] = useState<Awaited<ReturnType<typeof toolkitClient.getInstance>> | null>(null);

  useEffect(() => {
    setFull(null);
    toolkitClient.getInstance(instance.id).then(setFull).catch(() => setFull(null));
  }, [instance.id, instance.updatedAt]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-outline/60 px-6 pt-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold">{instance.name}</h2>
              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase text-ink-muted">{full?.template.name ?? instance.templateId}</span>
              <div className={cn("size-2 rounded-full", !instance.enabled ? "bg-outline-strong" : instance.healthStatus === "error" ? "bg-destructive" : instance.healthStatus === "ok" ? "bg-emerald-500" : "bg-warning")} />
              {!instance.enabled ? <span className="text-[11px] text-warning">disabled</span> : null}
              {instance.healthError ? <span className="truncate text-[11px] text-destructive" title={instance.healthError}>{instance.healthError}</span> : null}
            </div>
            {full?.template.pollIntervalMs ? (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted">
                <Activity className="size-3" /> polling every {Math.round(full.template.pollIntervalMs / 1000)}s
              </p>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                await toolkitClient.checkHealth(instance.id).catch(() => null);
                await data.refreshInstances();
              }}
              className="flex items-center gap-1 rounded-md border border-outline/60 px-2 py-1 text-[12px] text-ink-muted hover:border-outline-strong hover:text-ink"
            >
              <HeartPulse className="size-3.5" /> Check health
            </button>
            {full?.template.pollIntervalMs ? (
              <button
                type="button"
                onClick={async () => {
                  await toolkitClient.runPoll(instance.id).catch(() => null);
                }}
                className="flex items-center gap-1 rounded-md border border-outline/60 px-2 py-1 text-[12px] text-ink-muted hover:border-outline-strong hover:text-ink"
              >
                <Play className="size-3.5" /> Poll now
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] transition-colors",
                section === s.id ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
        <div className="-mt-px h-px bg-outline/60" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {!full ? (
          <div className="flex h-full items-center justify-center text-ink-muted"><Loader2 className="size-5 animate-spin" /></div>
        ) : section === "tools" ? (
          <ToolsSection instance={instance} tools={full.tools} />
        ) : section === "events" ? (
          <EventsSection instance={instance} />
        ) : section === "queues" ? (
          <QueuesSection instance={instance} />
        ) : (
          <SettingsSection data={data} instance={instance} full={full} />
        )}
      </div>
    </div>
  );
}

// --- tools --------------------------------------------------------------------

function ToolsSection({ instance, tools }: { instance: ConnectorInstance; tools: Tool[] }) {
  const [openTool, setOpenTool] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [output, setOutput] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (tool: Tool) => {
    setBusy(true);
    setErr(null);
    setOutput(null);
    try {
      const typed: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(tool.params)) {
        const v = params[`${tool.id}.${k}`];
        if (v === undefined || v === "") continue;
        typed[k] = spec.type === "number" ? Number(v) : v;
      }
      const r = await toolkitClient.invokeTool(tool.id, typed);
      setOutput(r.output);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[12px] text-ink-muted">
        {tools.length} tools available on this instance. Other apps invoke them as <code className="font-mono">POST /apps/toolkit/tools/&#123;toolId&#125;/invoke</code>.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {tools.map((tool) => {
          const open = openTool === tool.id;
          return (
            <li key={tool.id} className="rounded-lg border border-outline/60 bg-surface">
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => { setOpenTool(open ? null : tool.id); setOutput(null); setErr(null); }}>
                <Wrench className="size-4 shrink-0 text-ink-muted" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[13px] font-semibold">{tool.name}</p>
                  <p className="text-[12px] text-ink-muted">{tool.description}</p>
                </div>
                <span className="shrink-0 text-[11px] text-ink-muted">{open ? "−" : "+"}</span>
              </button>
              {open ? (
                <div className="border-t border-outline/60 px-4 py-3">
                  {Object.keys(tool.params).length === 0 ? (
                    <p className="text-[12px] text-ink-muted">No parameters.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {Object.entries(tool.params).map(([k, spec]) => (
                        <div key={k}>
                          <label className="text-[11px] font-medium text-ink-muted">
                            <span className="font-mono">{k}</span> — {spec.description}
                            {spec.required ? " *" : ""}
                          </label>
                          {spec.type === "enum" && spec.options ? (
                            <select
                              value={params[`${tool.id}.${k}`] ?? ""}
                              onChange={(e) => setParams({ ...params, [`${tool.id}.${k}`]: e.target.value })}
                              className="mt-0.5 h-8 w-full rounded-md bg-surface-muted px-2 font-mono text-[12px] outline-none"
                            >
                              <option value="">—</option>
                              {spec.options.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              value={params[`${tool.id}.${k}`] ?? ""}
                              onChange={(e) => setParams({ ...params, [`${tool.id}.${k}`]: e.target.value })}
                              placeholder={spec.type}
                              className="mt-0.5 h-8 w-full rounded-md bg-surface-muted px-2 font-mono text-[12px] outline-none"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <button type="button" disabled={busy} onClick={() => void run(tool)} className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-accent-foreground disabled:opacity-50">
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Run
                    </button>
                    {err ? <span className="text-[12px] text-destructive">{err}</span> : null}
                  </div>
                  {output !== null ? (
                    <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-surface-muted p-3 font-mono text-[11px] leading-relaxed">{JSON.stringify(output, null, 2)}</pre>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --- events -------------------------------------------------------------------

function EventsSection({ instance }: { instance: ConnectorInstance }) {
  const [events, setEvents] = useState<BroadcastEvent[] | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await toolkitClient.listEvents({ instanceId: instance.id, limit: 100 });
      setEvents(r.events);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [instance.id]);

  useEffect(() => {
    void load();
    const es = new EventSource(`/apps/toolkit/events/stream?instanceId=${encodeURIComponent(instance.id)}&token=${encodeURIComponent(new URLSearchParams(location.search).get("token") ?? "")}`);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (m) => {
      try {
        const parsed = JSON.parse(m.data) as { event: string; instanceId: string; payload: unknown; at?: string };
        setEvents((prev) => [parsed as unknown as BroadcastEvent, ...(prev ?? [])].slice(0, 200));
      } catch { /* skip malformed */ }
    };
    esRef.current = es;
    return () => { es.close(); esRef.current = null; };
  }, [load, instance.id]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-ink-muted">
          Recent broadcasts of this instance. Listen from any app via <code className="font-mono">GET /apps/toolkit/events?instanceId=…</code> or the SSE stream.
        </p>
        <span className={cn("flex items-center gap-1 text-[11px]", live ? "text-emerald-600" : "text-ink-muted")}>
          <span className={cn("size-1.5 rounded-full", live ? "bg-emerald-500 animate-pulse" : "bg-outline-strong")} /> {live ? "live" : "offline"}
        </span>
      </div>
      {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}
      {events === null ? (
        <div className="mt-8 flex justify-center text-ink-muted"><Loader2 className="size-4 animate-spin" /></div>
      ) : events.length === 0 ? (
        <p className="mt-8 text-center text-[13px] text-ink-muted">No broadcasts yet — the poller emits events when work items change.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 rounded-md border border-outline/50 bg-surface px-3 py-2">
              <span className="mt-0.5 rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">{e.event}</span>
              <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-[11px] text-ink-muted">{JSON.stringify(e.payload)}</pre>
              <span className="shrink-0 text-[10px] text-ink-muted">{new Date(e.createdAt).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- queues -------------------------------------------------------------------

function QueuesSection({ instance }: { instance: ConnectorInstance }) {
  const [queues, setQueues] = useState<QueueInfo[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drained, setDrained] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await toolkitClient.listQueues(instance.id);
      setQueues(r.queues);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [instance.id]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [load]);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      await toolkitClient.createQueue(instance.id, name.trim());
      setName("");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[12px] text-ink-muted">
        Durable queues other apps requested for this instance's broadcasts — every event is inserted, so nothing is lost when a live broadcast is dropped. Consume with <code className="font-mono">POST /apps/toolkit/queues/&#123;instanceId&#125;/&#123;name&#125;/next</code>.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="queue-name (e.g. twoloop-sync)"
          className="h-9 flex-1 rounded-md bg-surface-muted px-2.5 font-mono text-[13px] outline-none focus:ring-1 focus:ring-outline-strong"
        />
        <button type="button" disabled={busy || !/^[\w][\w-]*$/.test(name.trim())} onClick={() => void create()} className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-foreground disabled:opacity-50">
          <Plus className="size-3.5" /> Request queue
        </button>
      </div>
      {err ? <p className="mt-2 text-[12px] text-destructive">{err}</p> : null}
      {queues === null ? (
        <div className="mt-8 flex justify-center text-ink-muted"><Loader2 className="size-4 animate-spin" /></div>
      ) : queues.length === 0 ? (
        <p className="mt-8 text-center text-[13px] text-ink-muted">No queues requested yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {queues.map((q) => (
            <li key={q.id} className="flex items-center gap-3 rounded-lg border border-outline/60 bg-surface px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[13px] font-semibold">{q.name}</p>
                <p className="text-[11px] text-ink-muted">
                  {q.pending} pending · created {new Date(q.createdAt).toLocaleString()}
                </p>
              </div>
              {q.pending > 0 ? (
                <button
                  type="button"
                  onClick={async () => {
                    const r = await toolkitClient.nextQueueItem(instance.id, q.name).catch(() => null);
                    setDrained(r?.item ? { queue: q.name, item: r.item } : null);
                    await load();
                  }}
                  className="flex items-center gap-1 rounded-md border border-outline/60 px-2 py-1 text-[12px] text-ink-muted hover:border-outline-strong hover:text-ink"
                >
                  <Play className="size-3" /> Next
                </button>
              ) : null}
              <button
                type="button"
                aria-label={`Delete queue ${q.name}`}
                className="rounded-md p-1.5 text-ink-muted hover:bg-destructive/10 hover:text-destructive"
                onClick={async () => {
                  if (confirm(`Delete queue "${q.name}" and its items?`)) {
                    await toolkitClient.deleteQueue(instance.id, q.name);
                    await load();
                  }
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {drained ? (
        <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-surface-muted p-3 font-mono text-[11px]">{JSON.stringify(drained, null, 2)}</pre>
      ) : null}
    </div>
  );
}

// --- settings -----------------------------------------------------------------

function SettingsSection({ data, instance, full }: { data: ToolkitData; instance: ConnectorInstance; full: NonNullable<Awaited<ReturnType<typeof toolkitClient.getInstance>>> }) {
  const [scope, setScope] = useState(instance.scope);
  const [agentIds, setAgentIds] = useState<string[]>(instance.agentIds);
  const [enabled, setEnabled] = useState(instance.enabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    scope.all !== instance.scope.all ||
    JSON.stringify(scope.ids) !== JSON.stringify(instance.scope.ids) ||
    JSON.stringify(agentIds) !== JSON.stringify(instance.agentIds) ||
    enabled !== instance.enabled;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await toolkitClient.updateInstance(instance.id, { scope, agentIds, enabled });
      await data.refreshInstances();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <p className="text-[12px] font-medium text-ink-muted">Template</p>
        <p className="text-[13px]">{full.template.name} — {full.template.description}</p>
      </div>
      <div>
        <p className="text-[12px] font-medium text-ink-muted">Instance id</p>
        <p className="font-mono text-[12px] text-ink-muted">{instance.id}</p>
        <p className="mt-1 text-[11px] text-ink-muted">
          Agents address these tools by name — <code className="font-mono">{slug(instance.name)}_&lt;command&gt;</code> via artisan's <code className="font-mono">call_tool</code>.
        </p>
      </div>
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-muted">Spaces</p>
        <ScopePicker spaces={data.spaces} value={scope} onChange={setScope} />
      </div>
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-ink-muted">Agent access</p>
        <AgentAccessPicker agents={data.agents} value={agentIds} onChange={setAgentIds} />
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-accent" />
        Enabled
      </label>
      {err ? <p className="text-[12px] text-destructive">{err}</p> : null}
      <div>
        <button type="button" disabled={busy || !dirty} onClick={() => void save()} className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-foreground disabled:opacity-50">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

function slug(name: string): string {
  return name.toLowerCase().trim().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "tool";
}
