import { useNavigate, useParams } from "react-router";
import { randomId } from "@/lib/utils";
import { AGENT_TYPE_LABELS, useWorkspace } from "../use-workspace";
import { useCodeDirectories } from "../../../code/directories/use-code-directories";
import { AgentSheet, AGENTS_LIST_PATH } from "./agent-sheet";
import { Empty, PanelShell, ResourceTable } from "../workspace-panels";

export function AgentsSection() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const ws = useWorkspace();
  const { directories } = useCodeDirectories();
  const dirName = (id: string | null) => (id ? (directories.data?.find((d) => d.id === id)?.displayName ?? "removed directory") : null);

  return (
    <PanelShell
      title="Agents"
      hint="subagents, personas, collaborators and the sentinel — each with its own system prompt and tools"
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
                <span>
                  {AGENT_TYPE_LABELS[a.type]} ·{" "}
                  <code className="font-mono">
                    {a.provider} / {a.model}
                  </code>
                  {a.type === "persona" && a.workDirectoryId ? ` · runs in ${dirName(a.workDirectoryId)}` : null}
                </span>
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
