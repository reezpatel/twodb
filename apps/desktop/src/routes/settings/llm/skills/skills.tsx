import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { randomId } from "@/lib/utils";
import type { Skill } from "../use-workspace";
import { SkillSheet, SKILLS_LIST_PATH } from "./skill-sheet";
import { Empty, PanelShell, ResourceTable } from "../workspace-panels";

export function SkillsSection() {
  const { skillId } = useParams();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["workspace", "skills"], queryFn: () => api<Skill[]>("/api/skills") });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/skills/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["workspace", "skills"] }),
  });

  return (
    <PanelShell title="Skills" hint="reusable instructions the agent can load by name" onNew={() => navigate(`${SKILLS_LIST_PATH}/${randomId()}`)}>
      {list.isPending ? (
        <Empty pending label="skill" />
      ) : (
        <>
          <ResourceTable
            rows={(list.data ?? []).map((skill) => ({
              id: skill.id,
              name: skill.name,
              subtitle: <span className="line-clamp-1">{skill.description}</span>,
              tags: skill.tags,
              codeDirectoryId: skill.codeDirectoryId,
            }))}
            onEdit={(id) => navigate(`${SKILLS_LIST_PATH}/${id}`)}
            onDelete={(id) => remove.mutate(id, { onSuccess: () => skillId === id && navigate(SKILLS_LIST_PATH) })}
            deletePending={remove.isPending}
          />
          {(list.data ?? []).length === 0 && <Empty pending={false} label="skills" />}
        </>
      )}

      <SkillSheet />
    </PanelShell>
  );
}
