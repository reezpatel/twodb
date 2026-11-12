import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import { MilestoneDialog } from "./MilestoneDialog";
import { EmptyState, ProgressBar, Spinner } from "../../components/Visuals";
import { useMilestones } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { diffDays, formatDate, parseDate } from "../../lib/format";
import type { Milestone } from "../../lib/types";

const STATE_LABEL = { active: "Active", upcoming: "Upcoming", completed: "Completed" } as const;

function daysLeft(m: Milestone) {
  if (m.state === "completed") return m.completedAt ? "Finished early" : "Ended";
  const d = diffDays(new Date(), parseDate(m.endDate)!);
  return m.state === "upcoming" ? `Starts in ${diffDays(new Date(), parseDate(m.startDate)!)}d` : d >= 0 ? `${d}d left` : "Overdue";
}

export function MilestonesPage() {
  const { project } = useProjectCtx();
  const nav = useNavigate();
  const { data, isLoading } = useMilestones(project.key);
  const [creating, setCreating] = useState(false);
  if (isLoading) return <Spinner />;
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <div className="mb-4 flex items-center"><h1 className="text-lg font-semibold">Milestones</h1><Button size="sm" className="ml-auto" onClick={() => setCreating(true)}><Plus />New milestone</Button></div>
      {!data?.length ? <EmptyState title="No milestones yet" hint="Milestones are time-boxed iterations (sprints) with a start and end date." action={<Button onClick={() => setCreating(true)}>Create a milestone</Button>} /> : (["active", "upcoming", "completed"] as const).map((state) => {
        const items = data.filter((m) => m.state === state);
        if (!items.length) return null;
        return (
          <section key={state} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">{STATE_LABEL[state]}</h2>
            <div className="overflow-hidden rounded-md border border-outline">
              {(state === "completed" ? [...items].reverse() : items).map((m) => (
                <Link key={m.id} to={m.id} className="flex items-center gap-4 border-b border-outline/60 px-4 py-3 last:border-0 hover:bg-stone">
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{m.name}</div><div className="mt-0.5 truncate text-xs text-ink-muted">{formatDate(m.startDate)} → {formatDate(m.endDate)}{m.goal ? ` · ${m.goal}` : ""}</div></div>
                  <span className="w-28 text-right text-xs text-ink-muted">{daysLeft(m)}</span>
                  <div className="flex w-48 items-center gap-2"><ProgressBar done={m.progress.done} inProgress={m.progress.inProgress} total={m.progress.total} /><span className="w-16 shrink-0 text-right text-xs text-ink-muted">{m.progress.done}/{m.progress.total}</span></div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      <MilestoneDialog open={creating} onOpenChange={setCreating} onCreated={(m) => nav(m.id)} />
    </div>
  );
}
