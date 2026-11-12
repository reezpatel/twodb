import { CalendarDays, Flag, Layers, Milestone as MilestoneIcon, Tag, UserRound, X } from "lucide-react";
import { Picker, PopoverBox, triggerCls } from "./Picker";
import { Avatar, LabelPill, PriorityIcon, StatusIcon, TypeIcon } from "./Visuals";
import { useProjectCtx } from "../lib/project-context";
import { useMembers } from "../lib/members";
import { useEpics, useMilestones } from "../lib/queries";
import { PRIORITIES, priorityMeta } from "../lib/meta";
import { formatDate, today } from "../lib/format";
import type { Priority } from "../lib/types";

const muted = "text-ink-muted";
interface P<V> { value: V; onChange: (v: V) => void; compact?: boolean; disabled?: boolean }

export function StatusPicker({ value, onChange, compact, disabled }: P<string>) {
  const { config, status } = useProjectCtx();
  const s = status(value);
  return (
    <Picker disabled={disabled} searchable value={value} onChange={(v) => v && onChange(v)}
      options={config.statuses.map((x) => ({ id: x.id, label: x.name, icon: <StatusIcon category={x.category} color={x.color} /> }))}
      trigger={<button type="button" className={triggerCls} title={s?.name}>{s ? <StatusIcon category={s.category} color={s.color} /> : null}{compact ? null : <span className="truncate">{s?.name}</span>}</button>} />
  );
}

export function PriorityPicker({ value, onChange, compact, disabled }: P<Priority | null>) {
  const m = priorityMeta(value);
  return (
    <Picker disabled={disabled} value={value} onChange={(v) => onChange(v as Priority | null)} clearLabel="No priority"
      options={PRIORITIES.map((p) => ({ id: p.id, label: p.label, icon: <PriorityIcon priority={p.id} /> }))}
      trigger={<button type="button" className={triggerCls} title={m?.label ?? "No priority"}><PriorityIcon priority={value} />{compact ? null : <span className={m ? "" : muted}>{m?.label ?? "No priority"}</span>}</button>} />
  );
}

export function AssigneePicker({ value, onChange, compact, disabled }: P<string | null>) {
  const { members, byId } = useMembers();
  const m = byId(value);
  return (
    <Picker disabled={disabled} searchable value={value} onChange={onChange} clearLabel="Unassigned" placeholder="Assign to…"
      options={members.map((x) => ({ id: x.id, label: x.name, hint: x.email, icon: <Avatar name={x.name} image={x.image} size={18} /> }))}
      trigger={<button type="button" className={triggerCls} title={m?.name ?? "Unassigned"}>{m ? <Avatar name={m.name} image={m.image} size={18} /> : <UserRound className={`size-4 ${muted}`} />}{compact ? null : <span className={m ? "truncate" : muted}>{m?.name ?? "Unassigned"}</span>}</button>} />
  );
}

export function TypePicker({ value, onChange, compact, disabled }: P<string | null>) {
  const { config, type } = useProjectCtx();
  const t = type(value);
  return (
    <Picker disabled={disabled} value={value} onChange={onChange} clearLabel="No type"
      options={config.ticketTypes.map((x) => ({ id: x.id, label: x.name, icon: <TypeIcon icon={x.icon} color={x.color} /> }))}
      trigger={<button type="button" className={triggerCls} title={t?.name ?? "No type"}>{t ? <TypeIcon icon={t.icon} color={t.color} /> : <Tag className={`size-4 ${muted}`} />}{compact ? null : <span className={t ? "" : muted}>{t?.name ?? "No type"}</span>}</button>} />
  );
}

export function EpicPicker({ value, onChange, compact, disabled }: P<string | null>) {
  const { project } = useProjectCtx();
  const { data: epics = [] } = useEpics(project.key);
  const e = epics.find((x) => x.id === value);
  return (
    <Picker disabled={disabled} searchable value={value} onChange={onChange} clearLabel="No epic" placeholder="Find epic…"
      options={epics.map((x) => ({ id: x.id, label: x.title }))}
      trigger={<button type="button" className={triggerCls} title={e?.title ?? "No epic"}><Layers className={`size-4 ${e ? "text-ion-deep" : muted}`} />{compact ? null : <span className={e ? "truncate" : muted}>{e?.title ?? "No epic"}</span>}</button>} />
  );
}

export function MilestonePicker({ value, onChange, compact, disabled }: P<string | null>) {
  const { project } = useProjectCtx();
  const { data: ms = [] } = useMilestones(project.key);
  const m = ms.find((x) => x.id === value);
  return (
    <Picker disabled={disabled} searchable value={value} onChange={onChange} clearLabel="No milestone" placeholder="Find milestone…"
      options={ms.map((x) => ({ id: x.id, label: x.name, hint: `${formatDate(x.startDate)} – ${formatDate(x.endDate)}` }))}
      trigger={<button type="button" className={triggerCls} title={m?.name ?? "No milestone"}><MilestoneIcon className={`size-4 ${m ? "text-ion-deep" : muted}`} />{compact ? null : <span className={m ? "truncate" : muted}>{m?.name ?? "No milestone"}</span>}</button>} />
  );
}

export function LabelsPicker({ value, onChange, compact, disabled }: P<string[]>) {
  const { config, label } = useProjectCtx();
  const sel = value.map(label).filter(Boolean) as { id: string; name: string; color: string }[];
  const groups = new Map(config.labelGroups.map((g) => [g.id, g.name]));
  return (
    <Picker multiple disabled={disabled} searchable value={value} onChange={onChange} placeholder="Filter labels…"
      options={config.labels.map((l) => ({ id: l.id, label: l.name, hint: l.groupId ? groups.get(l.groupId) : undefined, icon: <span className="size-2.5 rounded-full" style={{ background: l.color }} /> }))}
      trigger={
        <button type="button" className={triggerCls} title="Labels">
          {sel.length ? (compact ? <span className="flex -space-x-1">{sel.slice(0, 3).map((l) => <span key={l.id} className="size-3 rounded-full ring-2 ring-paper" style={{ background: l.color }} />)}</span> : <span className="flex flex-wrap gap-1">{sel.map((l) => <LabelPill key={l.id} name={l.name} color={l.color} />)}</span>)
            : <><Tag className={`size-4 ${muted}`} />{compact ? null : <span className={muted}>No labels</span>}</>}
        </button>
      } />
  );
}

export function DateField({ value, onChange, compact, disabled, label = "Set date", icon }: P<string | null> & { label?: string; icon?: React.ReactNode }) {
  return (
    <PopoverBox width="w-56" trigger={
      <button type="button" disabled={disabled} className={triggerCls} title={label}>
        {icon ?? <CalendarDays className={`size-4 ${value ? "" : muted}`} />}
        {compact && !value ? null : <span className={value ? "" : muted}>{value ? formatDate(value) : label}</span>}
      </button>}>
      <input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="w-full rounded-sm border border-outline bg-paper px-2 py-1.5 text-sm" />
      <div className="mt-2 flex justify-between text-xs">
        <button type="button" className="text-ion-deep hover:underline" onClick={() => onChange(today())}>Today</button>
        {value ? <button type="button" className="inline-flex items-center gap-1 text-ink-muted hover:text-ink" onClick={() => onChange(null)}><X className="size-3" />Clear</button> : null}
      </div>
    </PopoverBox>
  );
}

export const DueIcon = () => <Flag className="size-4" />;
