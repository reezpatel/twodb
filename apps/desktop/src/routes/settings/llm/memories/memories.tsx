import { useNavigate, useParams } from "react-router";
import { randomId } from "@/lib/utils";
import { useWorkspace } from "../use-workspace";
import { MemorySheet, MEMORIES_LIST_PATH } from "./memory-sheet";
import { Empty, PanelShell, ResourceTable } from "../workspace-panels";

export function MemoriesSection() {
  const { memoryId } = useParams();
  const navigate = useNavigate();
  const ws = useWorkspace();

  return (
    <PanelShell title="Memories" hint="long-lived facts the agent recalls — tag and scope them" onNew={() => navigate(`${MEMORIES_LIST_PATH}/${randomId()}`)}>
      {ws.memories.list.isPending ? (
        <Empty pending label="memory" />
      ) : (
        <>
          <ResourceTable
            rows={(ws.memories.list.data ?? []).map((m) => ({
              id: m.id,
              name: <span className="line-clamp-1 font-normal">{m.content}</span>,
              subtitle: m.scopeId ? <code className="font-mono">{m.scopeId}</code> : undefined,
              tags: m.tags,
              codeDirectoryId: m.codeDirectoryId,
            }))}
            onEdit={(id) => navigate(`${MEMORIES_LIST_PATH}/${id}`)}
            onDelete={(id) => ws.memories.remove.mutate(id, { onSuccess: () => memoryId === id && navigate(MEMORIES_LIST_PATH) })}
            deletePending={ws.memories.remove.isPending}
          />
          {(ws.memories.list.data ?? []).length === 0 && <Empty pending={false} label="memories" />}
        </>
      )}

      <MemorySheet />
    </PanelShell>
  );
}
