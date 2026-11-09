import { useNavigate, useParams } from "react-router";
import { randomId } from "@/lib/utils";
import { useWorkspace } from "../use-workspace";
import { InstructionSheet, INSTRUCTIONS_LIST_PATH } from "./instruction-sheet";
import { Empty, PanelShell, ResourceTable } from "../workspace-panels";

export function InstructionsSection() {
  const { instructionId } = useParams();
  const navigate = useNavigate();
  const ws = useWorkspace();

  return (
    <PanelShell
      title="Instructions"
      hint="instruction docs normally synced from machines — manage them by hand here"
      onNew={() => navigate(`${INSTRUCTIONS_LIST_PATH}/${randomId()}`)}
    >
      {ws.instructions.list.isPending ? (
        <Empty pending label="instruction" />
      ) : (
        <>
          <ResourceTable
            rows={(ws.instructions.list.data ?? []).map((i) => ({
              id: i.id,
              name: i.instructionPath ? (
                <code className="font-mono text-xs">{i.instructionPath}</code>
              ) : (
                <span className="font-normal">Untitled instruction</span>
              ),
              subtitle: <span className="line-clamp-1">{i.instruction}</span>,
              tags: i.tags,
              codeDirectoryId: i.codeDirectoryId,
            }))}
            onEdit={(id) => navigate(`${INSTRUCTIONS_LIST_PATH}/${id}`)}
            onDelete={(id) => ws.instructions.remove.mutate(id, { onSuccess: () => instructionId === id && navigate(INSTRUCTIONS_LIST_PATH) })}
            deletePending={ws.instructions.remove.isPending}
          />
          {(ws.instructions.list.data ?? []).length === 0 && <Empty pending={false} label="instructions" />}
        </>
      )}

      <InstructionSheet />
    </PanelShell>
  );
}
