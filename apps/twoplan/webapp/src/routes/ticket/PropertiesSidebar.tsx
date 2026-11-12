import { Eye, EyeOff } from "lucide-react";
import { Input } from "@twodb/blocks";
import { AssigneePicker, DateField, EpicPicker, LabelsPicker, MilestonePicker, PriorityPicker, StatusPicker, TypePicker } from "../../components/PropertyPickers";
import { Picker, triggerCls } from "../../components/Picker";
import { useProjectCtx } from "../../lib/project-context";
import { formatMinutes, parseMinutes, timeAgo } from "../../lib/format";
import type { CustomField, TicketDetail } from "../../lib/types";
import type { TicketPageApi } from "./useTicketPage";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex min-h-8 items-center gap-2"><span className="w-24 shrink-0 text-xs text-ink-muted">{label}</span><div className="min-w-0 flex-1">{children}</div></div>
);

function CustomFieldControl({ field, value, onChange }: { field: CustomField; value: unknown; onChange: (v: unknown) => void }) {
  switch (field.type) {
    case "checkbox": return <input type="checkbox" className="ml-2" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    case "select": {
      const opt = field.options.find((o) => o.id === value);
      return <Picker value={(value as string) ?? null} onChange={onChange} clearLabel="None" options={field.options.map((o) => ({ id: o.id, label: o.label, icon: <span className="size-2.5 rounded-full" style={{ background: o.color }} /> }))}
        trigger={<button type="button" className={triggerCls}>{opt ? <><span className="size-2.5 rounded-full" style={{ background: opt.color }} />{opt.label}</> : <span className="text-ink-muted">None</span>}</button>} />;
    }
    case "date": return <DateField value={(value as string) ?? null} onChange={onChange} label="Set date" />;
    case "number": return <Input type="number" defaultValue={(value as number) ?? ""} key={String(value)} className="h-7" onBlur={(e) => { const n = e.target.value === "" ? null : Number(e.target.value); if (n !== (value ?? null)) onChange(n); }} />;
    default: return <Input type={field.type === "url" ? "url" : "text"} defaultValue={(value as string) ?? ""} key={String(value)} className="h-7" placeholder={field.type === "url" ? "https://" : ""} onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (value ?? null)) onChange(v); }} />;
  }
}

export function PropertiesSidebar({ t, api }: { t: TicketDetail; api: TicketPageApi }) {
  const { project, config } = useProjectCtx();
  const set = (body: Record<string, unknown>) => api.update.mutate(body);
  const watching = !!api.me && t.watcherUserIds.includes(api.me);
  return (
    <aside className="flex w-80 shrink-0 flex-col gap-1 border-l border-outline p-4 text-sm">
      <Row label="Status"><StatusPicker value={t.statusId} onChange={(v) => set({ statusId: v })} /></Row>
      <Row label="Priority"><PriorityPicker value={t.priority} onChange={(v) => set({ priority: v })} /></Row>
      <Row label="Assignee"><AssigneePicker value={t.assigneeUserId} onChange={(v) => set({ assigneeUserId: v })} /></Row>
      <Row label="Type"><TypePicker value={t.typeId} onChange={(v) => set({ typeId: v })} /></Row>
      <Row label="Labels"><LabelsPicker value={t.labelIds} onChange={(v) => set({ labelIds: v })} /></Row>
      <div className="my-2 border-t border-outline" />
      <Row label="Epic"><EpicPicker value={t.epicId} onChange={(v) => set({ epicId: v })} /></Row>
      <Row label="Milestone"><MilestonePicker value={t.milestoneId} onChange={(v) => set({ milestoneId: v })} /></Row>
      <Row label="Start date"><DateField value={t.startDate} onChange={(v) => set({ startDate: v })} label="Set start" /></Row>
      <Row label="Due date"><DateField value={t.dueDate} onChange={(v) => set({ dueDate: v })} label="Set due" /></Row>
      {project.pointsEstimateEnabled ? <Row label="Points"><Input type="number" min={0} step="0.5" key={String(t.estimatePoints)} defaultValue={t.estimatePoints ?? ""} className="h-7 w-24" onBlur={(e) => { const n = e.target.value === "" ? null : Number(e.target.value); if (n !== t.estimatePoints) set({ estimatePoints: n }); }} /></Row> : null}
      {project.timeEstimateEnabled ? <Row label="Estimate"><Input key={String(t.estimateMinutes)} defaultValue={formatMinutes(t.estimateMinutes)} placeholder="e.g. 1h 30m" className="h-7 w-32" onBlur={(e) => { const m = parseMinutes(e.target.value); if (m !== t.estimateMinutes) set({ estimateMinutes: m }); }} /></Row> : null}
      {config.customFields.length ? <div className="my-2 border-t border-outline" /> : null}
      {config.customFields.map((f) => <Row key={f.id} label={f.name}><CustomFieldControl field={f} value={t.fieldValues[f.id]} onChange={(v) => api.setField.mutate({ fieldId: f.id, value: v })} /></Row>)}
      <div className="my-2 border-t border-outline" />
      <button type="button" onClick={() => api.watch.mutate(!watching)} className="inline-flex items-center gap-2 self-start rounded-sm px-2 py-1 text-sm text-ink-muted hover:bg-paper-grid hover:text-ink">
        {watching ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{watching ? "Unwatch" : "Watch"}<span className="text-xs">· {t.watcherUserIds.length}</span>
      </button>
      <div className="px-2 pt-1 text-xs text-ink-muted">Created {timeAgo(t.createdAt)} · Updated {timeAgo(t.updatedAt)}</div>
    </aside>
  );
}
