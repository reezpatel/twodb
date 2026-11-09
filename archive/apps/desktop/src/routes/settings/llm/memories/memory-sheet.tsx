import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { MEMORY_SCOPE_LABELS, useWorkspace, type MemoryScope } from "../use-workspace";
import { useCodeDirectories } from "../../../code/directories/use-code-directories";
import { EditorSheet } from "../editor-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpaceSelect } from "@/components/space-select";
import { urls } from "@/lib/url-registry";

export const MEMORIES_LIST_PATH = urls.settings.llm.memories();

const SCOPES: MemoryScope[] = ["organization", "code_directory", "agent", "session"];

export function MemorySheet() {
  const { memoryId } = useParams();
  const navigate = useNavigate();
  const close = () => navigate(MEMORIES_LIST_PATH);

  const ws = useWorkspace();
  const { directories } = useCodeDirectories();
  const existing = memoryId ? ws.memories.list.data?.find((m) => m.id === memoryId) : undefined;
  const isNew = Boolean(memoryId) && ws.memories.list.isSuccess && !existing;

  // Subagents have no memory of their own — they share their caller's.
  const ownerAgents = (ws.agents.list.data ?? []).filter((a) => a.type !== "sub_agent");

  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<MemoryScope>("organization");
  const [codeDirectoryId, setCodeDirectoryId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setScope(existing?.scope ?? "organization");
    setCodeDirectoryId(existing?.codeDirectoryId ?? "");
    setAgentId(existing?.agentId ?? "");
    setScopeId(existing?.scopeId ?? "");
    setSpaceId(existing?.spaceId ?? null);
    setError(null);
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialValue = useMemo(
    () => (memoryId && ws.memories.list.isSuccess ? (existing?.content ?? "") : ""),
    [memoryId, ws.memories.list.isSuccess, existing],
  );

  const fieldsDirty = existing
    ? title !== existing.title ||
      scope !== existing.scope ||
      codeDirectoryId !== (existing.codeDirectoryId ?? "") ||
      agentId !== (existing.agentId ?? "") ||
      scopeId !== (existing.scopeId ?? "") ||
      spaceId !== (existing.spaceId ?? null)
    : Boolean(title) || scope !== "organization" || Boolean(codeDirectoryId) || Boolean(agentId) || Boolean(scopeId) || spaceId !== null;

  const submit = (content: string) => {
    if (!memoryId) return;
    if (!title.trim()) return setError("Title is required");
    if (!content.trim()) return setError("Content is required");
    if (scope === "code_directory" && !codeDirectoryId) return setError("Pick a code directory");
    if (scope === "agent" && !agentId) return setError("Pick an agent");
    if (scope === "session" && !scopeId.trim()) return setError("Session id is required");
    ws.memories.save.mutate(
      {
        ...(existing ? { id: existing.id } : {}),
        title: title.trim(),
        content: content.trim(),
        scope,
        // Owner fields not used by the chosen scope are cleared server-side; send null explicitly.
        codeDirectoryId: scope === "code_directory" ? codeDirectoryId : null,
        agentId: scope === "agent" ? agentId : null,
        scopeId: scope === "session" ? scopeId.trim() : null,
        spaceId,
      },
      { onSuccess: close, onError: (e) => setError(e.message === "title_taken" ? "A memory with this title already exists at this level" : e.message) },
    );
  };

  return (
    <EditorSheet
      docKey={existing ? existing.id : (memoryId ?? null)}
      open={Boolean(memoryId)}
      loading={Boolean(memoryId) && ws.memories.list.isPending}
      title={isNew ? "New memory" : "Edit memory"}
      initialValue={initialValue}
      placeholder="What should be remembered…"
      ariaLabel="Memory content"
      error={error}
      savePending={ws.memories.save.isPending}
      submitLabel={isNew ? "Create memory" : "Save changes"}
      onSubmit={submit}
      onClose={close}
      fieldsDirty={fieldsDirty}
      fields={
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memory-title" className="text-muted-foreground text-xs">
              Title
            </Label>
            <Input
              id="memory-title"
              className="h-8 text-xs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short, unique — agents look it up by this"
              maxLength={120}
            />
          </div>
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="memory-scope" className="text-muted-foreground text-xs">
                Level
              </Label>
              <Select value={scope} onValueChange={(v) => setScope(v as MemoryScope)}>
                <SelectTrigger id="memory-scope" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((value) => (
                    <SelectItem key={value} value={value} className="text-xs">
                      {MEMORY_SCOPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {scope === "code_directory" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="memory-directory" className="text-muted-foreground text-xs">
                  Code directory
                </Label>
                <Select value={codeDirectoryId} onValueChange={setCodeDirectoryId}>
                  <SelectTrigger id="memory-directory" className="h-8 text-xs">
                    <SelectValue placeholder="Pick a directory" />
                  </SelectTrigger>
                  <SelectContent>
                    {(directories.data ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">
                        {d.displayName} <span className="text-muted-foreground font-mono">{d.cwd}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {scope === "agent" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="memory-agent" className="text-muted-foreground text-xs">
                  Agent
                </Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger id="memory-agent" className="h-8 text-xs">
                    <SelectValue placeholder="Persona, collaborator or sentinel" />
                  </SelectTrigger>
                  <SelectContent>
                    {ownerAgents.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.description || `${a.provider} · ${a.model}`} <span className="text-muted-foreground">{a.type}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {scope === "session" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="memory-scope-id" className="text-muted-foreground text-xs">
                  Session id
                </Label>
                <Input id="memory-scope-id" className="h-8 text-xs" value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder="code session" />
              </div>
            )}
          </div>
          <SpaceSelect id="memory-space" value={spaceId} onChange={setSpaceId} />
        </div>
      }
    />
  );
}
