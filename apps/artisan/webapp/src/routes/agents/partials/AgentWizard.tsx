import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, ModelPicker, type ModelEntry, type ModelProvider } from "@twodb/blocks";
import { artisanClient, type AgentInfo, type ModelInfo, type SpaceInfo } from "../../../lib/artisan-client.js";
import { SpaceMultiSelect } from "./SpaceMultiSelect.js";
import { FolderPicker } from "../../shell/partials/FolderPicker.js";
import { MICROVM, RunnerStep, Stepper } from "../../shell/partials/DirectoryDialog.js";

const TYPES: Array<{ id: string; label: string; hint: string }> = [
  { id: "sub_agent", label: "Sub-agent", hint: "Invoked by a running session to do a focused task." },
  { id: "persona", label: "Persona", hint: "A standing assistant you can start sessions with." },
  { id: "collaborator", label: "Collaborator", hint: "Works alongside you and other agents." },
];

export interface AgentWizardProps {
  models: ModelInfo[];
  onClose: () => void;
  /** Called after the agent is created (the prompt and tools are set by editing it). */
  onCreated: (agent: AgentInfo) => Promise<void>;
}

/** New agent wizard: Basics (type, name, space) → Runner (or inherit) →
 *  Directory (unless inherited) → Model. The prompt and tools are filled in
 *  afterwards, by selecting the agent. */
export function AgentWizard(props: AgentWizardProps) {
  const [type, setType] = useState("sub_agent");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [spaces, setSpaces] = useState<SpaceInfo[]>([]);
  const [spaceIds, setSpaceIds] = useState<string[]>([]);
  const [inheritRunner, setInheritRunner] = useState(true);
  const [runner, setRunner] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const [inheritModel, setInheritModel] = useState(false);
  const [model, setModel] = useState("");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    artisanClient
      .listSpaces()
      .then((list) => {
        setSpaces(list);
        setSpaceIds((cur) => (cur.length || !list[0] ? cur : [list[0].id]));
      })
      .catch(() => setSpaces([]));
  }, []);
  useEffect(() => {
    if (!model && props.models[0]) setModel(props.models[0].id);
  }, [props.models, model]);

  const steps = useMemo(() => (inheritRunner ? ["Basics", "Runner", "Model"] : ["Basics", "Runner", "Directory", "Model"]), [inheritRunner]);
  const current = steps[step];
  const last = step === steps.length - 1;

  const providers = useMemo<ModelProvider[]>(() => {
    const byConn = new Map<string, ModelEntry[]>();
    for (const m of props.models) {
      const list = byConn.get(m.connection) ?? [];
      list.push({ id: m.id, label: m.name, context: m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k` : undefined, triggerLabel: m.id, thinking: m.thinking });
      byConn.set(m.connection, list);
    }
    return [...byConn.entries()].map(([n, models]) => ({ id: n, title: n, models }));
  }, [props.models]);

  const onPick = useCallback((p: string | null) => setPath(p), []);

  const canNext = current === "Basics" ? Boolean(name.trim()) : current === "Runner" ? inheritRunner || Boolean(runner) : current === "Directory" ? Boolean(path) : true;

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const agent = await artisanClient.createAgent({
        type,
        name: name.trim(),
        description: description.trim(),
        spaceIds: spaceIds.length ? spaceIds : undefined,
        model: inheritModel ? null : model || null,
        runner: inheritRunner ? null : runner,
        directory: inheritRunner ? null : path,
      });
      await props.onCreated(agent);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const next = () => {
    if (!canNext) return;
    setError(null);
    if (last) void submit();
    else setStep(step + 1);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) props.onClose(); }}>
      <DialogContent
        className="max-w-xl"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" && !last && canNext && (e.target as HTMLElement).tagName !== "BUTTON" && (e.target as HTMLElement).tagName !== "SELECT") {
            e.preventDefault();
            next();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>New agent</DialogTitle>
        </DialogHeader>
        <Stepper step={step} steps={steps} onJump={(i) => { setError(null); setStep(i); }} />

        <div className="min-h-[22rem] py-1">
          {current === "Basics" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Type</Label>
                <div className="grid gap-1.5">
                  {TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id)}
                      className={`flex flex-col rounded-lg px-3 py-2 text-left transition-colors ${type === t.id ? "bg-primary/15" : "bg-surface-muted/40 hover:bg-surface-muted"}`}
                    >
                      <span className="text-[13px] font-medium text-ink">{t.label}</span>
                      <span className="text-[11px] text-ink-muted">{t.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="code-reviewer" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Description <span className="font-normal text-ink-muted">(shown to callers)</span></Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Reviews diffs for bugs and style issues" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="shrink-0">
                  <Label>Spaces</Label>
                  <p className="text-[12px] text-ink-muted">Pick one or more.</p>
                </div>
                <SpaceMultiSelect spaces={spaces} value={spaceIds} onChange={setSpaceIds} />
              </div>
            </div>
          ) : null}

          {current === "Runner" ? (
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-2.5 rounded-lg bg-surface-muted/40 px-3 py-2.5">
                <Checkbox className="mt-0.5" checked={inheritRunner} onCheckedChange={(v) => setInheritRunner(Boolean(v))} />
                <span>
                  <span className="block text-[13px] font-medium text-ink">Inherit runner and directory</span>
                  <span className="block text-[12px] text-ink-muted">Run wherever the calling session runs. Uncheck to pin this agent to one runner and folder.</span>
                </span>
              </label>
              {!inheritRunner ? <RunnerStep runner={runner} onSelect={(r) => { if (r !== runner) setPath(null); setRunner(r); }} /> : null}
            </div>
          ) : null}

          {current === "Directory" ? (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] text-ink-muted">
                Pick the folder on <span className="font-mono text-ink">{runner}</span> this agent works in.
              </p>
              <FolderPicker key={runner} runner={runner} startPath={runner.startsWith(MICROVM) ? "/app" : "~"} onChange={onPick} className="h-[20rem]" />
            </div>
          ) : null}

          {current === "Model" ? (
            <div className="flex flex-col gap-4">
              <label className="flex items-start gap-2.5 rounded-lg bg-surface-muted/40 px-3 py-2.5">
                <Checkbox className="mt-0.5" checked={inheritModel} onCheckedChange={(v) => setInheritModel(Boolean(v))} />
                <span>
                  <span className="block text-[13px] font-medium text-ink">Use the calling session's model</span>
                  <span className="block text-[12px] text-ink-muted">Uncheck to always use a specific model.</span>
                </span>
              </label>
              {!inheritModel ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Model</Label>
                    <p className="text-[12px] text-ink-muted">Used whenever this agent runs.</p>
                  </div>
                  {providers.length > 0 ? <ModelPicker providers={providers} value={model} onChange={setModel} /> : <span className="text-[12px] text-ink-muted">no models</span>}
                </div>
              ) : null}
              <p className="rounded-lg bg-surface-muted/40 px-3 py-2 text-[12px] text-ink-muted">
                After creating the agent you will land on its page to write the prompt and choose its tools.
              </p>
            </div>
          ) : null}
        </div>

        {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => { setError(null); setStep(step - 1); }}>
                <ArrowLeft className="size-3.5" /> Back
              </Button>
            ) : null}
            <Button onClick={next} disabled={!canNext || saving}>
              {last ? (
                <>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : null} Create agent
                </>
              ) : (
                <>
                  Next <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
