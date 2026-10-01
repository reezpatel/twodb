import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useWorkspace } from "../use-workspace";
import { EditorSheet } from "../editor-sheet";
import { TagInput } from "../tag-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const INSTRUCTIONS_LIST_PATH = "/apps/settings/llm/instructions";

export function InstructionSheet() {
  const { instructionId } = useParams();
  const navigate = useNavigate();
  const close = () => navigate(INSTRUCTIONS_LIST_PATH);

  const ws = useWorkspace();
  const existing = instructionId ? ws.instructions.list.data?.find((i) => i.id === instructionId) : undefined;
  const isNew = Boolean(instructionId) && ws.instructions.list.isSuccess && !existing;

  const [instructionPath, setInstructionPath] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInstructionPath(existing?.instructionPath ?? "");
    setTags(existing?.tags ?? []);
    setError(null);
  }, [existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const initialValue = useMemo(
    () => (instructionId && ws.instructions.list.isSuccess ? (existing?.instruction ?? "") : ""),
    [instructionId, ws.instructions.list.isSuccess, existing],
  );

  const fieldsDirty = existing
    ? instructionPath !== (existing.instructionPath ?? "") || JSON.stringify(tags) !== JSON.stringify(existing.tags)
    : Boolean(instructionPath || tags.length > 0);

  const submit = (content: string) => {
    if (!instructionId) return;
    if (!content.trim()) {
      setError("Instruction is required");
      return;
    }
    void ws
      .saveInstruction({
        ...(existing ? { id: existing.id } : {}),
        instruction: content,
        instructionPath: instructionPath.trim() || null,
        tags,
      })
      .then(close)
      .catch((e: Error) => setError(e.message));
  };

  return (
    <EditorSheet
      docKey={existing ? existing.id : (instructionId ?? null)}
      open={Boolean(instructionId)}
      loading={Boolean(instructionId) && ws.instructions.list.isPending}
      title={instructionPath.trim() || (isNew ? "New instruction" : "Edit instruction")}
      initialValue={initialValue}
      placeholder="Instruction markdown…"
      ariaLabel="Instruction content"
      error={error}
      savePending={ws.instructions.save.isPending}
      submitLabel={isNew ? "Create instruction" : "Save changes"}
      onSubmit={submit}
      onClose={close}
      fieldsDirty={fieldsDirty}
      fields={
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="instr-path" className="text-muted-foreground text-xs">
              Path <span className="text-muted-foreground/60">(optional)</span>
            </Label>
            <Input
              id="instr-path"
              className="h-8 font-mono text-xs"
              value={instructionPath}
              onChange={(e) => setInstructionPath(e.target.value)}
              placeholder="/home/dev/twodb/AGENTS.md"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="instr-tags" className="text-muted-foreground text-xs">
              Tags
            </Label>
            <TagInput id="instr-tags" value={tags} onChange={setTags} />
          </div>
        </>
      }
    />
  );
}
