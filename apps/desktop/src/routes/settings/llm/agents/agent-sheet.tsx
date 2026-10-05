import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useWorkspace } from "../use-workspace";
import { EditorSheet } from "../editor-sheet";
import { TagInput } from "../tag-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const AGENTS_LIST_PATH = "/apps/settings/llm/agents";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProvider(existing?.provider ?? "");
    setModel(existing?.model ?? "");
    setDescription(existing?.description ?? "");
    setTags(existing?.tags ?? []);
    setError(null);
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialValue = useMemo(() => (agentId && ws.agents.list.isSuccess ? (existing?.instruction ?? "") : ""), [agentId, ws.agents.list.isSuccess, existing]);

  const fieldsDirty = existing
    ? provider !== existing.provider ||
      model !== existing.model ||
      description !== (existing.description ?? "") ||
      JSON.stringify(tags) !== JSON.stringify(existing.tags)
    : Boolean(provider || model || description || tags.length > 0);

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
            <Label htmlFor="agent-desc" className="text-muted-foreground text-xs">
              Description
            </Label>
            <Input id="agent-desc" className="h-8 text-xs" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional label" />
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
