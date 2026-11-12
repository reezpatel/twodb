import { ListFilter, X } from "lucide-react";
import { Picker, triggerCls } from "../../components/Picker";
import { Avatar, PriorityIcon, StatusIcon, TypeIcon } from "../../components/Visuals";
import { useProjectCtx } from "../../lib/project-context";
import { useMembers } from "../../lib/members";
import { useEpics, useMilestones } from "../../lib/queries";
import { PRIORITIES } from "../../lib/meta";

interface Props { get: (k: string) => string | null; set: (k: string, v: string | null) => void; clear: () => void; activeCount: number }

const csv = (s: string | null) => (s ? s.split(",") : []);

function FilterButton({ label, count, ...rest }: { label: string; count: number } & React.ComponentProps<"button">) {
  return (
    <button type="button" {...rest} className={`${triggerCls} border border-dashed border-outline ${count ? "border-solid bg-paper-grid" : "text-ink-muted"}`}>
      {label}{count ? <span className="rounded-full bg-ink px-1.5 text-[11px] text-paper">{count}</span> : null}
    </button>
  );
}

/** One multi-select per dimension; values live in the URL as comma-separated ids. */
export function FilterBar({ get, set, clear, activeCount }: Props) {
  const { config } = useProjectCtx();
  const { members } = useMembers();
  const { data: epics = [] } = useEpics(useProjectCtx().project.key);
  const { data: milestones = [] } = useMilestones(useProjectCtx().project.key);

  const multi = (param: string, label: string, options: { id: string; label: string; icon?: React.ReactNode }[]) => (
    <Picker multiple searchable={options.length > 6} value={csv(get(param))} onChange={(v) => set(param, v.length ? v.join(",") : null)} options={options}
      trigger={<FilterButton label={label} count={csv(get(param)).length} />} />
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ListFilter className="size-4 text-ink-muted" />
      {multi("status", "Status", config.statuses.map((s) => ({ id: s.id, label: s.name, icon: <StatusIcon category={s.category} color={s.color} /> })))}
      {multi("assignee", "Assignee", [{ id: "none", label: "Unassigned" }, ...members.map((m) => ({ id: m.id, label: m.name, icon: <Avatar name={m.name} image={m.image} size={16} /> }))])}
      {multi("priority", "Priority", [{ id: "none", label: "No priority", icon: <PriorityIcon priority={null} /> }, ...PRIORITIES.map((p) => ({ id: p.id, label: p.label, icon: <PriorityIcon priority={p.id} /> }))])}
      {multi("type", "Type", config.ticketTypes.map((t) => ({ id: t.id, label: t.name, icon: <TypeIcon icon={t.icon} color={t.color} /> })))}
      {multi("epic", "Epic", [{ id: "none", label: "No epic" }, ...epics.map((e) => ({ id: e.id, label: e.title }))])}
      {multi("milestone", "Milestone", [{ id: "none", label: "No milestone" }, ...milestones.map((m) => ({ id: m.id, label: m.name }))])}
      {config.labels.length ? multi("label", "Label", config.labels.map((l) => ({ id: l.id, label: l.name, icon: <span className="size-2.5 rounded-full" style={{ background: l.color }} /> }))) : null}
      {activeCount ? <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-ink-muted hover:text-ink"><X className="size-3" />Clear</button> : null}
    </div>
  );
}
