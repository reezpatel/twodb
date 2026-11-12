import { useState } from "react";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { Section, addBtn } from "./Section";
import { StatusPicker, AssigneePicker } from "../../components/PropertyPickers";
import { ProgressBar } from "../../components/Visuals";
import { CreateTicketDialog } from "../tickets/CreateTicketDialog";
import { useProjectCtx } from "../../lib/project-context";
import type { TicketDetail } from "../../lib/types";
import type { TicketPageApi } from "./useTicketPage";
import { patch } from "../../lib/api";
import { useApiMutation } from "../../lib/queries";

export function SubtasksPanel({ t }: { t: TicketDetail; api: TicketPageApi }) {
  const { project, status } = useProjectCtx();
  const [adding, setAdding] = useState(false);
  const upd = useApiMutation((v: { id: string } & Record<string, unknown>) => patch(`/tickets/${v.id}`, v));
  if (!project.subtasksEnabled || t.parentId) return null;
  const done = t.subtasks.filter((s) => ["done", "canceled"].includes(status(s.statusId)?.category ?? "")).length;
  return (
    <Section title="Sub-tasks" count={t.subtasks.length} action={<button className={addBtn} onClick={() => setAdding(true)}><Plus className="size-3" />Add</button>}>
      {t.subtasks.length ? <ProgressBar done={done} total={t.subtasks.length} /> : null}
      {t.subtasks.map((s) => (
        <div key={s.id} className="flex items-center gap-1 rounded-sm px-1 text-sm hover:bg-stone">
          <StatusPicker compact value={s.statusId} onChange={(v) => upd.mutate({ id: s.id, statusId: v })} />
          <span className="font-mono text-xs text-ink-muted">{s.identifier}</span>
          <Link to={`/p/${project.key}/t/${s.identifier}`} className="min-w-0 flex-1 truncate px-1 hover:underline">{s.title}</Link>
          <AssigneePicker compact value={s.assigneeUserId} onChange={(v) => upd.mutate({ id: s.id, assigneeUserId: v })} />
        </div>
      ))}
      <CreateTicketDialog open={adding} onOpenChange={setAdding} defaults={{ parentId: t.id, epicId: t.epicId, milestoneId: t.milestoneId }} />
    </Section>
  );
}
