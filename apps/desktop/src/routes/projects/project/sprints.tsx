import { useState } from "react";
import { useNavigate } from "react-router";
import { Check, Plus, Zap } from "lucide-react";
import type { ProjectDetail } from "../use-projects";
import { useProjectMutation, useTickets, useVelocity } from "../use-projects";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

/** Sprints tab: sprint cards with planned/completed points (velocity), plus
 * activate/close actions. */
export function Sprints({ detail, subprojectId }: { detail: ProjectDetail; subprojectId?: string }) {
  const navigate = useNavigate();
  const velocity = useVelocity(detail.project.id);
  const [name, setName] = useState("");
  const create = useProjectMutation(
    (n: string) => api(`/api/projects/projects/${detail.project.id}/sprints`, { method: "POST", body: JSON.stringify({ name: n }) }),
    [detail.project.id],
  );
  const patch = useProjectMutation(
    ({ id, ...body }: { id: string; status?: string }) => api(`/api/projects/sprints/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    [detail.project.id],
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Sprints</h2>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          setName("");
          create.mutate(n);
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint name — e.g. Sprint 12" className="h-8 text-sm" />
        <Button size="sm" type="submit" disabled={!name.trim()}>
          <Plus size={13} /> Add
        </Button>
      </form>
      <div className="flex flex-col gap-2">
        {(velocity.data ?? []).map(({ sprint, plannedPoints, completedPoints }) => (
          <Card key={sprint.id}>
            <CardContent className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <Zap size={13} className={sprint.status === "active" ? "text-amber-500" : "text-muted-foreground"} />
                <span className="text-sm font-medium">{sprint.name}</span>
                <span className="text-muted-foreground text-[10px] uppercase">{sprint.status}</span>
                {(sprint.startDate || sprint.endDate) && (
                  <span className="text-muted-foreground text-[10px]">
                    {sprint.startDate ?? "?"} → {sprint.endDate ?? "?"}
                  </span>
                )}
                <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                  {completedPoints}/{plannedPoints} pts
                </span>
                {sprint.status === "planned" && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => patch.mutate({ id: sprint.id, status: "active" })}>
                    Start
                  </Button>
                )}
                {sprint.status === "active" && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => patch.mutate({ id: sprint.id, status: "closed" })}>
                    <Check size={10} /> Close
                  </Button>
                )}
              </div>
              <Progress value={plannedPoints > 0 ? (completedPoints / plannedPoints) * 100 : 0} className="h-1.5" />
              <SprintTickets
                projectId={detail.project.id}
                sprintId={sprint.id}
                subprojectId={subprojectId}
                onOpen={(id) => navigate(`/apps/projects/${detail.project.id}/ticket/${id}`)}
              />
            </CardContent>
          </Card>
        ))}
        {velocity.data?.length === 0 && <p className="text-muted-foreground py-6 text-center text-xs">No sprints yet.</p>}
      </div>
      {(velocity.data ?? []).some((v) => v.sprint.status === "closed") && (
        <p className="text-muted-foreground text-xs">
          Avg velocity (closed sprints):{" "}
          {Math.round(
            (velocity.data ?? []).filter((v) => v.sprint.status === "closed").reduce((a, v) => a + v.completedPoints, 0) /
              Math.max(1, (velocity.data ?? []).filter((v) => v.sprint.status === "closed").length),
          )}{" "}
          pts
        </p>
      )}
    </div>
  );
}

function SprintTickets({
  projectId,
  sprintId,
  subprojectId,
  onOpen,
}: {
  projectId: string;
  sprintId: string;
  subprojectId?: string;
  onOpen: (ticketId: string) => void;
}) {
  const tickets = useTickets(projectId, { sprintId, ...(subprojectId ? { subprojectId } : {}) });
  const list = (tickets.data ?? []).filter((t) => !t.inBacklog);
  if (!list.length) return null;
  return (
    <div className="flex flex-col gap-0.5 border-t pt-2">
      {list.slice(0, 8).map((t) => (
        <button key={t.id} className="hover:bg-accent/40 flex items-center gap-2 rounded px-1 py-0.5 text-left text-[11px]" onClick={() => onOpen(t.id)}>
          <span className="text-muted-foreground font-mono text-[9px]">{t.identifier}</span>
          <span className="min-w-0 flex-1 truncate">{t.title}</span>
          <span className="rounded-full px-1 text-[8px] text-white" style={{ backgroundColor: t.status?.color ?? "#888" }}>
            {t.status?.name}
          </span>
        </button>
      ))}
      {list.length > 8 && <span className="text-muted-foreground px-1 text-[10px]">+{list.length - 8} more</span>}
    </div>
  );
}
