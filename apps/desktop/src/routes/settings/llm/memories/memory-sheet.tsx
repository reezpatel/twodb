import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useWorkspace } from "../use-workspace";
import { EditorSheet } from "../editor-sheet";
import { TagInput } from "../tag-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const MEMORIES_LIST_PATH = "/apps/settings/llm/memories";

export function MemorySheet() {
  const { memoryId } = useParams();
  const navigate = useNavigate();
  const close = () => navigate(MEMORIES_LIST_PATH);

  const ws = useWorkspace();
  const existing = memoryId ? ws.memories.list.data?.find((m) => m.id === memoryId) : undefined;
  const isNew = Boolean(memoryId) && ws.memories.list.isSuccess && !existing;

  const [scopeId, setScopeId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScopeId(existing?.scopeId ?? "");
    setTags(existing?.tags ?? []);
    setError(null);
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialValue = useMemo(
    () => (memoryId && ws.memories.list.isSuccess ? (existing?.content ?? "") : ""),
    [memoryId, ws.memories.list.isSuccess, existing],
  );

  const fieldsDirty = existing
    ? scopeId !== (existing.scopeId ?? "") || JSON.stringify(tags) !== JSON.stringify(existing.tags)
    : Boolean(scopeId || tags.length > 0);

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
        tags,
        scopeId: scopeId.trim() || null,
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
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memory-scope" className="text-muted-foreground text-xs">
              Scope
            </Label>
            <Input id="memory-scope" className="h-8 text-xs" value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder="optional" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memory-tags" className="text-muted-foreground text-xs">
              Tags
            </Label>
            <TagInput id="memory-tags" value={tags} onChange={setTags} />
          </div>
        </div>
      }
    />
  );
}
