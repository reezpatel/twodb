import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useWorkspace, AGENT_TYPE_LABELS, type AgentType } from "../use-workspace";
import { EditorSheet } from "../editor-sheet";
import { TagInput } from "../tag-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AGENT_TOOL_ALL, AGENT_TOOL_NAMES } from "@/lib/agent-tool-names";
import { cn } from "@/lib/utils";

export const AGENTS_LIST_PATH = "/apps/settings/llm/agents";

const AGENT_TYPES: AgentType[] = ["sub_agent", "persona", "collaborator", "sentinel"];

export function AgentSheet() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const close = () => navigate(AGENTS_LIST_PATH);

  const ws = useWorkspace();
  const existing = agentId ? ws.agents.list.data?.find((a) => a.id === agentId) : undefined;
  const isNew = Boolean(agentId) && ws.agents.list.isSuccess && !existing;

  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [type, setType] = useState<AgentType>("sub_agent");
  const [tools, setTools] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProvider(existing?.provider ?? "");
    setModel(existing?.model ?? "");
    setDescription(existing?.description ?? "");
    setTags(existing?.tags ?? []);
    setType(existing?.type ?? "sub_agent");
    setTools(existing?.tools ?? []);
    setError(null);
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialValue = useMemo(() => (agentId && ws.agents.list.isSuccess ? (existing?.instruction ?? "") : ""), [agentId, ws.agents.list.isSuccess, existing]);

  const fieldsDirty = existing
    ? provider !== existing.provider ||
      model !== existing.model ||
      description !== (existing.description ?? "") ||
      JSON.stringify(tags) !== JSON.stringify(existing.tags) ||
      type !== existing.type ||
      JSON.stringify(tools) !== JSON.stringify(existing.tools)
    : Boolean(provider || model || description || tags.length > 0 || tools.length > 0);

  const allTools = tools.includes(AGENT_TOOL_ALL);
  const toggleTool = (name: string) => {
    setTools((prev) => {
      if (name === AGENT_TOOL_ALL) return prev.includes(AGENT_TOOL_ALL) ? [] : [AGENT_TOOL_ALL];
      const withoutAll = prev.filter((t) => t !== AGENT_TOOL_ALL);
      return withoutAll.includes(name) ? withoutAll.filter((t) => t !== name) : [...withoutAll, name];
    });
  };

  const submit = (content: string) => {
    if (!agentId) return;
    if (!provider.trim() || !model.trim() || !content.trim()) {
      setError("Provider, model and system prompt are required");
      return;
    }
    ws.agents.save.mutate(
      {
        ...(existing ? { id: existing.id } : {}),
        provider: provider.trim(),
        model: model.trim(),
        description: description.trim() || null,
        instruction: content,
        tags,
        type,
        tools,
      },
      { onSuccess: close, onError: (e) => setError((e as Error).message) },
    );
  };

  return (
    <EditorSheet
      docKey={existing ? existing.id : (agentId ?? null)}
      open={Boolean(agentId)}
      loading={Boolean(agentId) && ws.agents.list.isPending}
      title={description.trim() || (isNew ? "New agent" : "Edit agent")}
      initialValue={initialValue}
      placeholder="This agent's system prompt — replaces the workspace default for its sessions…"
      ariaLabel="Agent system prompt"
      error={error}
      savePending={ws.agents.save.isPending}
      submitLabel={isNew ? "Create agent" : "Save changes"}
      onSubmit={submit}
      onClose={close}
      fieldsDirty={fieldsDirty}
      fields={
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-type" className="text-muted-foreground text-xs">
                Type
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as AgentType)}>
                <SelectTrigger id="agent-type" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {AGENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-desc" className="text-muted-foreground text-xs">
                Description
              </Label>
              <Input
                id="agent-desc"
                className="h-8 text-xs"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="optional label"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-provider" className="text-muted-foreground text-xs">
                Provider
              </Label>
              <Input id="agent-provider" className="h-8 text-xs" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="anthropic" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-model" className="text-muted-foreground text-xs">
                Model
              </Label>
              <Input id="agent-model" className="h-8 text-xs" value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-sonnet-4-5" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground text-xs">Tools</Label>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border p-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                <Checkbox
                  checked={allTools}
                  onCheckedChange={() => toggleTool(AGENT_TOOL_ALL)}
                  className={cn(allTools && "border-primary bg-primary text-primary-foreground")}
                />
                all (incl. future tools)
              </label>
              {AGENT_TOOL_NAMES.map((tool) => (
                <label key={tool.name} className="flex cursor-pointer items-center gap-2 text-xs" title={tool.hint}>
                  <Checkbox checked={!allTools && tools.includes(tool.name)} disabled={allTools} onCheckedChange={() => toggleTool(tool.name)} />
                  <span className={cn("font-mono", allTools && "text-muted-foreground")}>{tool.label}</span>
                </label>
              ))}
            </div>
            <p className="text-muted-foreground/70 text-[10px]">
              {allTools ? "Every tool, including ones added later" : tools.length === 0 ? "No tools — prompt-only agent" : `${tools.length} selected`}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-tags" className="text-muted-foreground text-xs">
              Tags
            </Label>
            <TagInput id="agent-tags" value={tags} onChange={setTags} />
          </div>
        </>
      }
    />
  );
}
