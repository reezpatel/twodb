import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Cpu, Loader2, MonitorSmartphone, Plus, Server } from "lucide-react";
import { Button, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, ModelPicker, type ModelEntry, type ModelProvider } from "@twodb/blocks";
import { artisanClient, type DirectoryInfo, type MicrovmInfo, type ModelInfo, type RunnerInfo, type SpaceInfo } from "../../../lib/artisan-client.js";
import { cn } from "../../../lib/cn.js";
import { FolderPicker } from "./FolderPicker.js";

export interface DirectoryDialogProps {
  /** When set, we're editing an existing directory (configure step only). */
  directory?: DirectoryInfo;
  models: ModelInfo[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    runner: string;
    path: string;
    spaceId?: string;
    title?: string;
    defaultModel?: string | null;
    projectSettings?: { loadAgents?: boolean; loadClaude?: boolean; loadAgentsMd?: boolean };
  }) => Promise<string | null>;
}

const STEPS = ["Runner", "Directory", "Configure"] as const;
export const MICROVM = "microvm:";

export function Stepper({ step, onJump, steps = STEPS }: { step: number; onJump: (i: number) => void; steps?: readonly string[] }) {
  return (
    <ol className="flex items-center gap-2 px-1">
      {steps.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <button
              type="button"
              disabled={!done}
              onClick={() => onJump(i)}
              className={cn("flex items-center gap-2 text-[13px] transition-colors", active ? "text-ink" : "text-ink-muted", done && "hover:text-ink")}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[11px] font-medium",
                  active ? "bg-primary text-paper" : done ? "bg-success/20 text-success" : "bg-surface-muted text-ink-muted",
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              {label}
            </button>
            {i < steps.length - 1 ? <span className={cn("h-px flex-1", done ? "bg-success/40" : "bg-outline")} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function RunnerRow({ icon: Icon, title, subtitle, selected, online = true, onClick }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  selected: boolean;
  online?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!online}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors disabled:opacity-50",
        selected ? "bg-primary/15" : "bg-surface-muted/40 hover:bg-surface-muted",
      )}
    >
      <Icon className="size-4 shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{title}</span>
        {subtitle ? <span className="block truncate text-[11px] text-ink-muted">{subtitle}</span> : null}
      </span>
      <span className={cn("size-2 shrink-0 rounded-full", online ? "bg-success" : "bg-ink-muted/30")} />
      <Check className={cn("size-4 shrink-0 text-primary", selected ? "opacity-100" : "opacity-0")} />
    </button>
  );
}

export function RunnerStep({ runner, onSelect }: { runner: string; onSelect: (r: string) => void }) {
  const [runners, setRunners] = useState<RunnerInfo[] | null>(null);
  const [vms, setVms] = useState<MicrovmInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    artisanClient.listRunners().then(setRunners).catch((e: Error) => setError(e.message));
    artisanClient.listMicrovms().then(setVms).catch(() => setVms([]));
  }, []);

  const hosts = runners ?? [];
  const hasVmHost = (runners ?? []).some((r) => r.kind === "microvm-host");

  const createVm = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const vm = await artisanClient.createMicrovm({ name: name.trim() || undefined });
      setVms((v) => [vm, ...v.filter((x) => x.identifier !== vm.identifier)]);
      setName("");
      onSelect(MICROVM + vm.identifier);
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex max-h-[26rem] flex-col gap-4 overflow-y-auto pr-1">
      <section className="flex flex-col gap-1.5">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">Host runners</h3>
        {!runners && !error ? <Loader2 className="size-4 animate-spin text-ink-muted" /> : null}
        {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
        {runners && hosts.length === 0 ? <p className="text-[12px] text-ink-muted">No host runners are online.</p> : null}
        {hosts.map((r) => (
          <RunnerRow key={r.name} icon={MonitorSmartphone} title={r.name} subtitle={r.kind === "microvm-host" ? "host runner · can run microVMs" : "host runner"} online={r.status === "online"} selected={runner === r.name} onClick={() => onSelect(r.name)} />
        ))}
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">MicroVMs</h3>
        {vms.map((vm) => (
          <RunnerRow
            key={vm.identifier}
            icon={Cpu}
            title={vm.identifier}
            subtitle={`${vm.status}${vm.runnerName ? ` · on ${vm.runnerName}` : ""}`}
            online={vm.status === "running" || vm.status === "idle-stopped"}
            selected={runner === MICROVM + vm.identifier}
            onClick={() => onSelect(MICROVM + vm.identifier)}
          />
        ))}
        <div className="rounded-lg bg-surface-muted/40 p-3">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink">
            <Plus className="size-4 text-ink-muted" /> Create a microVM
          </div>
          <p className="mb-2 text-[12px] text-ink-muted">
            An ephemeral Firecracker VM booted by dispatch. Its <code className="font-mono">/app</code> folder persists between runs.
          </p>
          {!hasVmHost ? <p className="mb-2 text-[12px] text-warning">No microvm-host runner is online, so a VM can't be booted right now.</p> : null}
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="name (optional)" className="h-8 flex-1 text-[13px]" onKeyDown={(e) => { if (e.key === "Enter" && hasVmHost && !creating) void createVm(); }} />
            <Button size="sm" onClick={() => void createVm()} disabled={creating || !hasVmHost}>
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Server className="size-3.5" />} {creating ? "Booting…" : "Create"}
            </Button>
          </div>
          {createError ? <p className="mt-2 text-[12px] text-destructive">{createError}</p> : null}
        </div>
      </section>
    </div>
  );
}

/** Add directory wizard: Runner → Directory (finder) → Configure. Editing an
 *  existing directory shows only the Configure step. */
export function DirectoryDialog(props: DirectoryDialogProps) {
  const d = props.directory;
  const [step, setStep] = useState(d ? 2 : 0);
  const [runner, setRunner] = useState(d?.runner ?? "");
  const [path, setPath] = useState<string | null>(d?.path ?? null);
  const [title, setTitle] = useState(d?.title ?? "");
  const [titleTouched, setTitleTouched] = useState(Boolean(d));
  const [model, setModel] = useState(d?.defaultModel ?? "");
  const [loadAgents, setLoadAgents] = useState(d?.projectSettings?.loadAgents ?? true);
  const [loadClaude, setLoadClaude] = useState(d?.projectSettings?.loadClaude ?? false);
  const [loadAgentsMd, setLoadAgentsMd] = useState(d?.projectSettings?.loadAgentsMd ?? true);
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);
  const [spaceId, setSpaceId] = useState(d?.spaceId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    artisanClient
      .listSpaces()
      .then((list) => {
        setSpaces(list);
        setSpaceId((cur) => (cur && list.some((s) => s.id === cur) ? cur : (list[0]?.id ?? cur)));
      })
      .catch(() => setSpaces([]));
  }, []);

  useEffect(() => {
    if (!model && props.models[0]) setModel(props.models[0].id);
  }, [props.models, model]);

  const folderName = path?.split("/").filter(Boolean).pop() ?? "";
  // Title follows the folder name until the user edits it.
  useEffect(() => {
    if (!titleTouched) setTitle(folderName);
  }, [folderName, titleTouched]);

  const providers = useMemo<ModelProvider[]>(() => {
    const byConn = new Map<string, ModelEntry[]>();
    for (const m of props.models) {
      const list = byConn.get(m.connection) ?? [];
      list.push({
        id: m.id,
        label: m.name,
        context: m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k` : undefined,
        triggerLabel: m.id,
        thinking: m.thinking,
      });
      byConn.set(m.connection, list);
    }
    return [...byConn.entries()].map(([name, models]) => ({ id: name, title: name, models }));
  }, [props.models]);

  const onPick = useCallback((p: string | null) => setPath(p), []);

  const canNext = step === 0 ? Boolean(runner) : step === 1 ? Boolean(path) : false;

  const next = () => {
    setError(null);
    setStep((s) => Math.min(2, s + 1));
  };

  const submit = async () => {
    setError(null);
    if (!d && (!runner || !path)) return setError("runner and directory are required");
    setSaving(true);
    try {
      await props.onSave({
        runner,
        path: path ?? "",
        spaceId: spaceId || undefined,
        title: title.trim() || folderName || undefined,
        defaultModel: model || null,
        projectSettings: { loadAgents, loadClaude, loadAgentsMd },
      });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) props.onClose(); }}>
      <DialogContent className="max-w-xl" onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" && step < 2 && canNext && (e.target as HTMLElement).tagName !== "INPUT") next();
      }}>
        <DialogHeader>
          <DialogTitle>{d ? "Edit directory" : "Add directory"}</DialogTitle>
        </DialogHeader>
        {!d ? <Stepper step={step} onJump={(i) => { setError(null); setStep(i); }} /> : null}

        <div className="min-h-[22rem] py-1">
          {step === 0 ? (
            <RunnerStep
              runner={runner}
              onSelect={(r) => {
                if (r !== runner) setPath(null);
                setRunner(r);
              }}
            />
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] text-ink-muted">
                Browse <span className="font-mono text-ink">{runner}</span> and pick a project folder — or create a new one.
              </p>
              <FolderPicker key={runner} runner={runner} startPath={runner.startsWith(MICROVM) ? "/app" : "~"} onChange={onPick} className="h-[20rem]" />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-surface-muted/40 px-3 py-2 text-[12px]">
                <div className="flex gap-2"><span className="w-14 text-ink-muted">Runner</span><span className="font-mono text-ink">{runner}</span></div>
                <div className="flex gap-2"><span className="w-14 text-ink-muted">Path</span><span className="min-w-0 truncate font-mono text-ink">{path}</span></div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} placeholder={folderName || "My project"} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Space</Label>
                  <p className="text-[12px] text-ink-muted">Agents, skills and model connections are scoped to a space.</p>
                </div>
                <select
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  disabled={spaces.length === 0}
                  className="h-9 min-w-40 rounded-md bg-surface-muted px-2 text-[13px] text-ink outline-none focus:ring-1 focus:ring-outline-strong disabled:opacity-60"
                >
                  {spaces.length === 0 ? <option value="">default</option> : null}
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Default model</Label>
                  <p className="text-[12px] text-ink-muted">Used for new sessions in this directory.</p>
                </div>
                {providers.length > 0 ? (
                  <ModelPicker providers={providers} value={model} onChange={setModel} />
                ) : (
                  <span className="text-[12px] text-ink-muted">no models</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[12px]">Project instruction files</Label>
                <label className="flex items-center gap-2 text-[12px] text-ink-muted">
                  <Checkbox checked={loadAgents} onCheckedChange={(v) => setLoadAgents(Boolean(v))} />
                  Load <code className="font-mono">.agents/AGENTS.md</code> (default)
                </label>
                <label className="flex items-center gap-2 text-[12px] text-ink-muted">
                  <Checkbox checked={loadClaude} onCheckedChange={(v) => setLoadClaude(Boolean(v))} />
                  Load <code className="font-mono">.claude/CLAUDE.md</code>
                </label>
                <label className="flex items-center gap-2 text-[12px] text-ink-muted">
                  <Checkbox checked={loadAgentsMd} onCheckedChange={(v) => setLoadAgentsMd(Boolean(v))} />
                  Load <code className="font-mono">AGENTS.md</code>
                </label>
              </div>
            </div>
          ) : null}
        </div>

        {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
          <div className="flex gap-2">
            {!d && step > 0 ? (
              <Button variant="ghost" onClick={() => { setError(null); setStep(step - 1); }}>
                <ArrowLeft className="size-3.5" /> Back
              </Button>
            ) : null}
            {step < 2 ? (
              <Button onClick={next} disabled={!canNext}>
                Next <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <Button onClick={() => void submit()} disabled={props.busy || saving}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : null} {d ? "Save" : "Add directory"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
