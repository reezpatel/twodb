import { useNavigate, useParams } from "react-router";
import { randomId } from "@/lib/utils";
import { useWorkspace } from "../use-workspace";
import { AgentSheet, AGENTS_LIST_PATH } from "./agent-sheet";
import { Empty, PanelShell, ResourceTable } from "../workspace-panels";

export function AgentsSection() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const ws = useWorkspace();

  return (
    <PanelShell
      title="Agents"
      hint="named provider/model + instruction combos a session can run as"
      onNew={() => navigate(`${AGENTS_LIST_PATH}/${randomId()}`)}
    >
      {ws.agents.list.isPending ? (
        <Empty pending label="agent" />
      ) : (
        <>
          <ResourceTable
            rows={(ws.agents.list.data ?? []).map((a) => ({
              id: a.id,
              name: a.description || `${a.provider} · ${a.model}`,
              subtitle: (
                <code className="font-mono">
                  {a.provider} / {a.model}
                </code>
              ),
              tags: a.tags,
              codeDirectoryId: a.codeDirectoryId,
            }))}
            onEdit={(id) => navigate(`${AGENTS_LIST_PATH}/${id}`)}
            onDelete={(id) => ws.agents.remove.mutate(id, { onSuccess: () => agentId === id && navigate(AGENTS_LIST_PATH) })}
            deletePending={ws.agents.remove.isPending}
          />
          {(ws.agents.list.data ?? []).length === 0 && <Empty pending={false} label="agents" />}
        </>
      )}

      <AgentSheet />
    </PanelShell>
  );
}
