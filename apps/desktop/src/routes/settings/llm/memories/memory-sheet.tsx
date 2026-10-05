import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useWorkspace, type MemoryScope } from "../use-workspace";
import { EditorSheet } from "../editor-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const MEMORIES_LIST_PATH = "/apps/settings/llm/memories";

const SCOPES: { value: MemoryScope; label: string }[] = [
  { value: "workspace", label: "Workspace" },
  { value: "project", label: "Project" },
  { value: "session", label: "Session" },
];

export function MemorySheet() {
  const { memoryId } = useParams();
  const navigate = useNavigate();
  const close = () => navigate(MEMORIES_LIST_PATH);

  const ws = useWorkspace();
  const existing = memoryId ? ws.memories.list.data?.find((m) => m.id === memoryId) : undefined;
  const isNew = Boolean(memoryId) && ws.memories.list.isSuccess && !existing;

  const [scope, setScope] = useState<MemoryScope>("workspace");
  const [scopeId, setScopeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScope(existing?.scope ?? "workspace");
    setScopeId(existing?.scopeId ?? "");
    setError(null);
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialValue = useMemo(
    () => (memoryId && ws.memories.list.isSuccess ? (existing?.content ?? "") : ""),
    [memoryId, ws.memories.list.isSuccess, existing],
  );

  const fieldsDirty = existing ? scope !== existing.scope || scopeId !== (existing.scopeId ?? "") : scope !== "workspace" || Boolean(scopeId);

  const submit = (content: string) => {
    if (!memoryId) return;
    if (!content.trim()) {
      setError("Content is required");
      return;
    }
    ws.memories.save.mutate(
      {
        ...(existing ? { id: existing.id } : {}),
        content: content.trim(),
        scope,
        scopeId: scope === "session" && scopeId.trim() ? scopeId.trim() : null,
      },
      { onSuccess: close, onError: (e) => setError((e as Error).message) },
    );
  };

  return (
    <EditorSheet
      docKey={existing ? existing.id : (memoryId ?? null)}
      open={Boolean(memoryId)}
      loading={Boolean(memoryId) && ws.memories.list.isPending}
      title={isNew ? "New memory" : "Edit memory"}
      initialValue={initialValue}
      placeholder="Something worth remembering…"
      ariaLabel="Memory content"
      error={error}
      savePending={ws.memories.save.isPending}
      submitLabel={isNew ? "Create memory" : "Save changes"}
      onSubmit={submit}
      onClose={close}
      fieldsDirty={fieldsDirty}
      fields={
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="memory-scope" className="text-muted-foreground text-xs">
                Scope
              </Label>
              <Select value={scope} onValueChange={(v) => setScope(v as MemoryScope)}>
                <SelectTrigger id="memory-scope" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {scope === "session" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="memory-scope-id" className="text-muted-foreground text-xs">
                  Session id
                </Label>
                <Input id="memory-scope-id" className="h-8 text-xs" value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder="code session" />
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}
