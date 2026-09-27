import { useState, type ReactNode } from "react";
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useWorkspace, type Agent, type Instruction, type Memory, type Skill } from "./use-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const fieldClasses = "flex flex-col gap-1.5";

function PanelShell({ title, hint, onNew, children }: { title: string; hint: string; onNew: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
        <Button size="sm" onClick={onNew}>
          <Plus size={13} /> New
        </Button>
      </div>
      {children}
    </div>
  );
}

function Row({ onEdit, onDelete, deletePending, children }: { onEdit: () => void; onDelete: () => void; deletePending: boolean; children: ReactNode }) {
  return (
    <li className="bg-card flex items-start gap-3 rounded-xl border p-3.5">
      <button className="min-w-0 flex-1 text-left" onClick={onEdit}>
        {children}
      </button>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon-sm" title="Edit" onClick={onEdit}>
          <Pencil size={13} />
        </Button>
        <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" title="Delete" disabled={deletePending} onClick={onDelete}>
          <Trash2 size={13} />
        </Button>
      </div>
    </li>
  );
}

function Empty({ pending, label }: { pending: boolean; label: string }) {
  return <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-xs">{pending ? "Loading…" : `No ${label} yet.`}</p>;
}

function ScopeBadge({ codeDirectoryId }: { codeDirectoryId: string | null }) {
  if (!codeDirectoryId) return null;
  return (
    <Badge variant="secondary" className="text-[10px]">
      directory
    </Badge>
  );
}

function fieldError(message: string | null) {
  return message ? <p className="text-destructive text-xs">{message}</p> : null;
}

export function SkillsPanel() {
  const ws = useWorkspace();
  const [editing, setEditing] = useState<Skill | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = (skill: Skill | null) => {
    setEditing(skill);
    setCreating(skill === null);
    setName(skill?.name ?? "");
    setDescription(skill?.description ?? "");
    setContent(skill?.content ?? "");
    setError(null);
  };

  const submit = () => {
    if (!name.trim() || !content.trim()) {
      setError("Name and content are required");
      return;
    }
    ws.skills.save.mutate(
      { ...(editing?.id ? { id: editing.id } : {}), name: name.trim(), description: description.trim(), content },
      { onSuccess: () => setEditing(null), onError: (e) => setError((e as Error).message) },
    );
  };

  return (
    <PanelShell title="Skills" hint="reusable instructions the agent can load by name" onNew={() => open(null)}>
      {ws.skills.list.isPending ? (
        <Empty pending label="skill" />
      ) : (
        <ul className="flex flex-col gap-2">
          {(ws.skills.list.data ?? []).map((s) => (
            <Row key={s.id} onEdit={() => open(s)} onDelete={() => ws.skills.remove.mutate(s.id)} deletePending={ws.skills.remove.isPending}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">{s.name}</span>
                <ScopeBadge codeDirectoryId={s.codeDirectoryId} />
              </div>
              <p className="text-muted-foreground line-clamp-1 text-xs">{s.description}</p>
            </Row>
          ))}
          {(ws.skills.list.data ?? []).length === 0 && <Empty pending={false} label="skills" />}
        </ul>
      )}

      <Dialog open={editing !== null || creating} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{creating ? "New skill" : "Edit skill"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className={fieldClasses}>
              <Label htmlFor="skill-name">Name</Label>
              <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="commit-style" />
            </div>
            <div className={fieldClasses}>
              <Label htmlFor="skill-desc">Description</Label>
              <Input id="skill-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="what this skill covers" />
            </div>
            <div className={fieldClasses}>
              <Label htmlFor="skill-content">Content</Label>
              <Textarea
                id="skill-content"
                className="min-h-40 font-mono text-xs"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Skill instructions…"
              />
            </div>
            {fieldError(error)}
          </div>
          <DialogFooter>
            <Button size="sm" disabled={ws.skills.save.isPending} onClick={submit}>
              {ws.skills.save.isPending && <Loader2 size={13} className="animate-spin" />}
              {creating ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}

export function AgentsPanel() {
  const ws = useWorkspace();
  const [editing, setEditing] = useState<Agent | null>(null);
  const [creating, setCreating] = useState(false);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [description, setDescription] = useState("");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = (agent: Agent | null) => {
    setEditing(agent);
    setCreating(agent === null);
    setProvider(agent?.provider ?? "");
    setModel(agent?.model ?? "");
    setDescription(agent?.description ?? "");
    setInstruction(agent?.instruction ?? "");
    setError(null);
  };

  const submit = () => {
    if (!provider || !model.trim() || !instruction.trim()) {
      setError("Provider, model and instruction are required");
      return;
    }
    ws.agents.save.mutate(
      {
        ...(editing?.id ? { id: editing.id } : {}),
        provider,
        model: model.trim(),
        description: description.trim() || null,
        instruction,
      },
      { onSuccess: () => setEditing(null), onError: (e) => setError((e as Error).message) },
    );
  };

  return (
    <PanelShell title="Agents" hint="named provider/model + instruction combos a session can run as" onNew={() => open(null)}>
      {ws.agents.list.isPending ? (
        <Empty pending label="agent" />
      ) : (
        <ul className="flex flex-col gap-2">
          {(ws.agents.list.data ?? []).map((a) => (
            <Row key={a.id} onEdit={() => open(a)} onDelete={() => ws.agents.remove.mutate(a.id)} deletePending={ws.agents.remove.isPending}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles size={12} className="text-primary shrink-0" aria-hidden="true" />
                <span className="truncate">{a.description || `${a.provider} · ${a.model}`}</span>
                <ScopeBadge codeDirectoryId={a.codeDirectoryId} />
              </div>
              <p className="text-muted-foreground truncate text-xs font-mono">
                {a.provider} / {a.model}
              </p>
            </Row>
          ))}
          {(ws.agents.list.data ?? []).length === 0 && <Empty pending={false} label="agents" />}
        </ul>
      )}

      <Dialog open={editing !== null || creating} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{creating ? "New agent" : "Edit agent"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className={fieldClasses}>
                <Label htmlFor="agent-provider">Provider</Label>
                <Input id="agent-provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="anthropic" />
              </div>
              <div className={fieldClasses}>
                <Label htmlFor="agent-model">Model</Label>
                <Input id="agent-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-sonnet-4-5" />
              </div>
            </div>
            <div className={fieldClasses}>
              <Label htmlFor="agent-desc">Description</Label>
              <Input id="agent-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional label" />
            </div>
            <div className={fieldClasses}>
              <Label htmlFor="agent-instruction">Instruction</Label>
              <Textarea
                id="agent-instruction"
                className="min-h-32 text-xs"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="System instructions for this agent…"
              />
            </div>
            {fieldError(error)}
          </div>
          <DialogFooter>
            <Button size="sm" disabled={ws.agents.save.isPending} onClick={submit}>
              {ws.agents.save.isPending && <Loader2 size={13} className="animate-spin" />}
              {creating ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}

export function MemoriesPanel() {
  const ws = useWorkspace();
  const [editing, setEditing] = useState<Memory | null>(null);
  const [creating, setCreating] = useState(false);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = (memory: Memory | null) => {
    setEditing(memory);
    setCreating(memory === null);
    setContent(memory?.content ?? "");
    setTags(memory?.tags.join(", ") ?? "");
    setScopeId(memory?.scopeId ?? "");
    setError(null);
  };

  const submit = () => {
    if (!content.trim()) {
      setError("Content is required");
      return;
    }
    ws.memories.save.mutate(
      {
        ...(editing?.id ? { id: editing.id } : {}),
        content: content.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        scopeId: scopeId.trim() || null,
      },
      { onSuccess: () => setEditing(null), onError: (e) => setError((e as Error).message) },
    );
  };

  return (
    <PanelShell title="Memories" hint="long-lived facts the agent recalls — tag and scope them" onNew={() => open(null)}>
      {ws.memories.list.isPending ? (
        <Empty pending label="memory" />
      ) : (
        <ul className="flex flex-col gap-2">
          {(ws.memories.list.data ?? []).map((m) => (
            <Row key={m.id} onEdit={() => open(m)} onDelete={() => ws.memories.remove.mutate(m.id)} deletePending={ws.memories.remove.isPending}>
              <p className="line-clamp-2 text-sm">{m.content}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <ScopeBadge codeDirectoryId={m.codeDirectoryId} />
                {m.scopeId && <code className="text-muted-foreground font-mono text-[10px]">{m.scopeId}</code>}
                {m.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            </Row>
          ))}
          {(ws.memories.list.data ?? []).length === 0 && <Empty pending={false} label="memories" />}
        </ul>
      )}

      <Dialog open={editing !== null || creating} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{creating ? "New memory" : "Edit memory"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className={fieldClasses}>
              <Label htmlFor="memory-content">Content</Label>
              <Textarea
                id="memory-content"
                className="min-h-24"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Something worth remembering…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={fieldClasses}>
                <Label htmlFor="memory-tags">Tags</Label>
                <Input id="memory-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="convention, db" />
              </div>
              <div className={fieldClasses}>
                <Label htmlFor="memory-scope">Scope</Label>
                <Input id="memory-scope" value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder="optional" />
              </div>
            </div>
            {fieldError(error)}
          </div>
          <DialogFooter>
            <Button size="sm" disabled={ws.memories.save.isPending} onClick={submit}>
              {ws.memories.save.isPending && <Loader2 size={13} className="animate-spin" />}
              {creating ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}

export function InstructionsPanel() {
  const ws = useWorkspace();
  const [editing, setEditing] = useState<Instruction | null>(null);
  const [creating, setCreating] = useState(false);
  const [instructionPath, setInstructionPath] = useState("");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = (row: Instruction | null) => {
    setEditing(row);
    setCreating(row === null);
    setInstructionPath(row?.instructionPath ?? "");
    setInstruction(row?.instruction ?? "");
    setError(null);
  };

  const submit = () => {
    if (!instructionPath.trim() || !instruction.trim()) {
      setError("Path and instruction are required");
      return;
    }
    void ws
      .saveInstruction({
        ...(editing ? { id: editing.id } : { instructionPath: instructionPath.trim() }),
        instruction,
      })
      .then(() => setEditing(null))
      .catch((e: Error) => setError(e.message));
  };

  return (
    <PanelShell title="Instructions" hint="instruction docs normally synced from machines — manage them by hand here" onNew={() => open(null)}>
      {ws.instructions.list.isPending ? (
        <Empty pending label="instruction" />
      ) : (
        <ul className="flex flex-col gap-2">
          {(ws.instructions.list.data ?? []).map((i) => (
            <Row key={i.id} onEdit={() => open(i)} onDelete={() => ws.instructions.remove.mutate(i.id)} deletePending={ws.instructions.remove.isPending}>
              <div className="flex items-center gap-2 text-sm">
                <code className="truncate font-mono text-xs">{i.instructionPath}</code>
                <ScopeBadge codeDirectoryId={i.codeDirectoryId} />
              </div>
              <p className="text-muted-foreground line-clamp-1 mt-0.5 text-xs">{i.instruction}</p>
            </Row>
          ))}
          {(ws.instructions.list.data ?? []).length === 0 && <Empty pending={false} label="instructions" />}
        </ul>
      )}

      <Dialog open={editing !== null || creating} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{creating ? "New instruction" : "Edit instruction"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className={fieldClasses}>
              <Label htmlFor="instr-path">Path</Label>
              <Input
                id="instr-path"
                className={cn("font-mono text-xs", !creating && "opacity-60")}
                value={instructionPath}
                onChange={(e) => setInstructionPath(e.target.value)}
                placeholder="/home/dev/twodb/AGENTS.md"
                disabled={!creating}
              />
            </div>
            <div className={fieldClasses}>
              <Label htmlFor="instr-content">Instruction</Label>
              <Textarea id="instr-content" className="min-h-40 font-mono text-xs" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            </div>
            {fieldError(error)}
          </div>
          <DialogFooter>
            <Button size="sm" onClick={submit}>
              {creating ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}
