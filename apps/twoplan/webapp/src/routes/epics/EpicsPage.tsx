import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { Button } from "@twodb/blocks";
import { EpicDialog } from "./EpicDialog";
import { EmptyState, ProgressBar, Spinner, Avatar } from "../../components/Visuals";
import { useEpics } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { useMembers } from "../../lib/members";
import { epicStatusMeta } from "../../lib/meta";
import { formatDate } from "../../lib/format";

export function EpicStatusBadge({ status }: { status: Parameters<typeof epicStatusMeta>[0] }) {
  const m = epicStatusMeta(status);
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-outline px-2 py-0.5 text-xs"><span className="size-2 rounded-full" style={{ background: m.color }} />{m.label}</span>;
}

export function EpicsPage() {
  const { project } = useProjectCtx();
  const nav = useNavigate();
  const { byId } = useMembers();
  const { data: epics, isLoading } = useEpics(project.key);
  const [creating, setCreating] = useState(false);
  if (isLoading) return <Spinner />;
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <div className="mb-4 flex items-center"><h1 className="text-lg font-semibold">Epics</h1><Button size="sm" className="ml-auto" onClick={() => setCreating(true)}><Plus />New epic</Button></div>
      {!epics?.length ? <EmptyState title="No epics yet" hint="Epics group tickets into larger bodies of work and roll up their progress." action={<Button onClick={() => setCreating(true)}>Create an epic</Button>} /> : (
        <div className="overflow-hidden rounded-md border border-outline">
          {epics.map((e) => { const owner = byId(e.ownerUserId); return (
            <Link key={e.id} to={e.id} className="flex items-center gap-4 border-b border-outline/60 px-4 py-3 last:border-0 hover:bg-stone">
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{e.title}</div><div className="mt-0.5 text-xs text-ink-muted">{e.startDate || e.targetDate ? `${formatDate(e.startDate) || "…"} → ${formatDate(e.targetDate) || "…"}` : "No dates"}</div></div>
              <EpicStatusBadge status={e.status} />
              <div className="flex w-48 items-center gap-2"><ProgressBar done={e.progress.done} inProgress={e.progress.inProgress} total={e.progress.total} /><span className="w-16 shrink-0 text-right text-xs text-ink-muted">{e.progress.done}/{e.progress.total}</span></div>
              <div className="w-6">{owner ? <Avatar name={owner.name} image={owner.image} size={22} /> : null}</div>
            </Link>
          ); })}
        </div>
      )}
      <EpicDialog open={creating} onOpenChange={setCreating} onCreated={(e) => nav(e.id)} />
    </div>
  );
}
