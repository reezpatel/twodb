import { useNavigate, useParams } from "react-router";
import { randomId } from "@/lib/utils";
import { MEMORY_SCOPE_LABELS, useWorkspace, type Agent, type Memory } from "../use-workspace";
import { useCodeDirectories } from "../../../code/directories/use-code-directories";
import { MemorySheet, MEMORIES_LIST_PATH } from "./memory-sheet";
import { Empty, PanelShell, ResourceTable } from "../workspace-panels";

const agentLabel = (agent: Agent | undefined) => (agent ? agent.description || `${agent.provider} · ${agent.model}` : undefined);

export function MemoriesSection() {
  const { memoryId } = useParams();
  const navigate = useNavigate();
  const ws = useWorkspace();
  const { directories } = useCodeDirectories();

  /** "Organization", "Code directory · api", "Agent · Planner" — the level plus whose it is. */
  const scopeLabel = (m: Memory) => {
    const owner =
      m.scope === "code_directory"
        ? directories.data?.find((d) => d.id === m.codeDirectoryId)?.displayName
        : m.scope === "agent"
          ? agentLabel(ws.agents.list.data?.find((a) => a.id === m.agentId))
          : undefined;
    return owner ? `${MEMORY_SCOPE_LABELS[m.scope]} · ${owner}` : MEMORY_SCOPE_LABELS[m.scope];
  };

  return (
    <PanelShell
      title="Memories"
      hint="long-lived facts agents recall — titles are listed, content is read on demand. Organization, code directory, or an agent's own"
      onNew={() => navigate(`${MEMORIES_LIST_PATH}/${randomId()}`)}
    >
      {ws.memories.list.isPending ? (
        <Empty pending label="memory" />
      ) : (
        <>
          <ResourceTable
            rows={(ws.memories.list.data ?? []).map((m) => ({
              id: m.id,
              name: m.title,
              subtitle: <span className="line-clamp-1">{m.content}</span>,
              scope: scopeLabel(m),
              // The scope column already says which directory — no extra badge.
              codeDirectoryId: null,
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
