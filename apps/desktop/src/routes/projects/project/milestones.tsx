import { useState } from "react";
import { Flag, Plus } from "lucide-react";
import type { ProjectDetail } from "../use-projects";
import { useProjectMutation, useTickets } from "../use-projects";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

/** Milestones tab: project-level milestones with done/total progress across
 * all subprojects' tickets. */
export function Milestones({ detail }: { detail: ProjectDetail }) {
  const tickets = useTickets(detail.project.id);
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const create = useProjectMutation(
    (b: { name: string; targetDate?: string }) => api(`/api/projects/projects/${detail.project.id}/milestones`, { method: "POST", body: JSON.stringify(b) }),
    [detail.project.id],
  );
  const patch = useProjectMutation(
    ({ id, ...body }: { id: string; status?: "open" | "closed" }) => api(`/api/projects/milestones/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    [detail.project.id],
  );

  const doneStatusIds = new Set(detail.statuses.filter((s) => s.category === "done").map((s) => s.id));
  const perMilestone = new Map<string, { total: number; done: number }>();
  for (const t of tickets.data ?? []) {
    if (!t.milestoneId) continue;
    const cur = perMilestone.get(t.milestoneId) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (doneStatusIds.has(t.statusId)) cur.done += 1;
    perMilestone.set(t.milestoneId, cur);
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-6">
      <h2 className="text-sm font-semibold">Milestones</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          setName("");
          setTargetDate("");
          create.mutate({ name: n, ...(targetDate ? { targetDate } : {}) });
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Milestone name — e.g. v1.0" className="h-8 text-sm" />
        <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="h-8 w-40 text-sm" />
        <Button size="sm" type="submit" disabled={!name.trim()}>
          <Plus size={13} /> Add
        </Button>
      </form>
      <div className="flex flex-col gap-2">
        {detail.milestones.map((m) => {
          const stats = perMilestone.get(m.id) ?? { total: 0, done: 0 };
          const pct = stats.total > 0 ? (stats.done / stats.total) * 100 : 0;
          return (
            <Card key={m.id}>
              <CardContent className="flex flex-col gap-1.5 p-3">
                <div className="flex items-center gap-2">
                  <Flag size={13} className={m.status === "closed" ? "text-success" : "text-amber-500"} />
                  <span className="text-sm font-medium">{m.name}</span>
                  {m.targetDate && <span className="text-muted-foreground text-[10px]">target {m.targetDate}</span>}
                  <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                    {stats.done}/{stats.total} done
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => patch.mutate({ id: m.id, status: m.status === "open" ? "closed" : "open" })}
                  >
                    {m.status === "open" ? "Close" : "Reopen"}
                  </Button>
                </div>
                <Progress value={pct} className="h-1.5" />
                {m.description && <p className="text-muted-foreground text-xs">{m.description}</p>}
              </CardContent>
            </Card>
          );
        })}
        {detail.milestones.length === 0 && <p className="text-muted-foreground py-6 text-center text-xs">No milestones yet.</p>}
      </div>
    </div>
  );
}
