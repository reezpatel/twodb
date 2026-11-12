import { useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useProjects, useSpaces } from "../../lib/queries";
import { EmptyState, ProgressBar, Spinner } from "../../components/Visuals";
import { CreateProjectDialog } from "./CreateProjectDialog";

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const { data: spaces = [] } = useSpaces();
  const [creating, setCreating] = useState(false);
  if (isLoading) return <Spinner />;
  const bySpace = spaces.map((s) => ({ space: s, items: (projects ?? []).filter((p) => p.spaceId === s.id) }));
  const orphans = (projects ?? []).filter((p) => !spaces.some((s) => s.id === p.spaceId));

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <Button size="sm" onClick={() => setCreating(true)}><Plus />New project</Button>
      </div>
      {!projects?.length ? <EmptyState title="No projects yet" hint="A project holds epics, milestones and tickets, and lives in a space." action={<Button onClick={() => setCreating(true)}>Create your first project</Button>} /> : null}
      {[...bySpace, ...(orphans.length ? [{ space: { id: "?", name: "Other" }, items: orphans }] : [])].filter((g) => g.items.length).map(({ space, items }) => (
        <section key={space.id} className="mb-8">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">{space.name}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <Link key={p.id} to={`/p/${p.key}/tickets`} className="group flex flex-col gap-3 rounded-md border border-outline bg-card p-4 transition-colors hover:border-ion-deep">
                <div className="flex items-center gap-2"><span className="rounded-sm bg-paper-grid px-1.5 py-0.5 font-mono text-xs">{p.key}</span><span className="truncate font-medium">{p.name}</span></div>
                {p.description ? <p className="line-clamp-2 text-sm text-ink-muted">{p.description}</p> : null}
                <div className="mt-auto flex flex-col gap-1.5">
                  <ProgressBar done={(p.ticketCount ?? 0) - (p.openTicketCount ?? 0)} total={p.ticketCount ?? 0} />
                  <span className="text-xs text-ink-muted">{p.openTicketCount ?? 0} open · {p.ticketCount ?? 0} total</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <CreateProjectDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
