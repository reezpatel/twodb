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
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6 overflow-y-auto px-8 py-8">
      <h2 className="text-lg font-semibold">Milestones</h2>
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
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Milestone name — e.g. v1.0" className="h-9 text-sm" />
        <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="h-9 w-40 text-sm" />
        <Button size="sm" type="submit" disabled={!name.trim()}>
          <Plus size={13} /> Add
        </Button>
      </form>
      <div className="flex flex-col gap-5">
        {detail.milestones.map((m) => {
          const stats = perMilestone.get(m.id) ?? { total: 0, done: 0 };
          const pct = stats.total > 0 ? (stats.done / stats.total) * 100 : 0;
          const closed = m.status === "closed";
          return (
            <Card key={m.id} className={closed ? "opacity-70" : ""}>
              <CardContent className="flex flex-col gap-4 p-6">
                <div className="flex items-center gap-3">
                  <span className={`flex size-9 items-center justify-center rounded-lg border ${closed ? "text-success border-success/40" : "border-amber-500/40 text-amber-500"}`}>
                    <Flag size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="truncate text-base font-semibold">{m.name}</span>
                      <span className="text-muted-foreground text-[11px] capitalize">{m.status}</span>
                    </div>
                    {m.targetDate && <span className="text-muted-foreground mt-0.5 block text-xs">Target {m.targetDate}</span>}
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => patch.mutate({ id: m.id, status: closed ? "open" : "closed" })}>
                    {closed ? "Reopen" : "Close milestone"}
                  </Button>
                </div>
                {m.description && <p className="text-muted-foreground text-sm leading-relaxed">{m.description}</p>}
                <div className="flex items-center gap-4">
                  <Progress value={pct} className="h-2 flex-1" />
                  <span className="text-muted-foreground w-28 text-right text-xs tabular-nums">
                    {Math.round(pct)}% · {stats.done}/{stats.total} done
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {detail.milestones.length === 0 && <p className="text-muted-foreground py-6 text-center text-xs">No milestones yet.</p>}
      </div>
    </div>
  );
}
