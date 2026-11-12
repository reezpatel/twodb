import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@twodb/blocks";
import { Group, ColorDot, randomColor, rowCls, bareInput } from "./parts";
import { StatusIcon, TypeIcon, TYPE_ICON_NAMES } from "../../components/Visuals";
import { del, patch, post } from "../../lib/api";
import { useApiMutation } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { CATEGORIES } from "../../lib/meta";
import { selectCls } from "../projects/CreateProjectDialog";
import type { StatusCategory } from "../../lib/types";

export function StatusesSettings() {
  const { project, config } = useProjectCtx();
  const base = `/projects/${project.key}/statuses`;
  const [name, setName] = useState("");
  const [category, setCategory] = useState<StatusCategory>("todo");
  const [err, setErr] = useState("");
  const add = useApiMutation(() => post(base, { name, category, color: randomColor() }), { onSuccess: () => setName("") });
  const upd = useApiMutation((v: { id: string } & Record<string, unknown>) => patch(`${base}/${v.id}`, v));
  const remove = useApiMutation((id: string) => del(`${base}/${id}`));
  const move = (i: number, dir: -1 | 1) => {
    const a = config.statuses[i], b = config.statuses[i + dir];
    if (!a || !b) return;
    upd.mutate({ id: a.id, position: b.position }); upd.mutate({ id: b.id, position: a.position });
  };
  return (
    <Group title="Workflow statuses" hint="The columns of your board. Each status belongs to a category that drives progress, overdue and “open” logic.">
      <div className="flex flex-col gap-1.5">
        {config.statuses.map((s, i) => (
          <div key={s.id} className={rowCls}>
            <StatusIcon category={s.category} color={s.color} /><ColorDot value={s.color} onChange={(color) => upd.mutate({ id: s.id, color })} />
            <input key={s.name} defaultValue={s.name} className={bareInput} onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && upd.mutate({ id: s.id, name: e.target.value.trim() })} aria-label="Status name" />
            <select value={s.category} onChange={(e) => upd.mutate({ id: s.id, category: e.target.value })} className="h-7 rounded-sm bg-transparent text-xs text-ink-muted" aria-label="Category">{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            <button className="rounded-sm p-1 text-ink-muted hover:bg-paper-grid disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="size-3.5" /></button>
            <button className="rounded-sm p-1 text-ink-muted hover:bg-paper-grid disabled:opacity-30" disabled={i === config.statuses.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="size-3.5" /></button>
            <button className="rounded-sm p-1 text-ink-muted hover:text-destructive" aria-label={`Delete ${s.name}`} onClick={() => { setErr(""); remove.mutate(s.id, { onError: (e) => setErr((e as Error).message) }); }}><Trash2 className="size-3.5" /></button>
          </div>
        ))}
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New status name" className="max-w-xs" />
        <select value={category} onChange={(e) => setCategory(e.target.value as StatusCategory)} className={`${selectCls} w-40`}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        <Button type="submit" size="sm" disabled={!name.trim()}><Plus />Add</Button>
      </form>
    </Group>
  );
}

export function TypesSettings() {
  const { project, config } = useProjectCtx();
  const base = `/projects/${project.key}/ticket-types`;
  const [name, setName] = useState("");
  const add = useApiMutation(() => post(base, { name, color: randomColor() }), { onSuccess: () => setName("") });
  const upd = useApiMutation((v: { id: string } & Record<string, unknown>) => patch(`${base}/${v.id}`, v));
  const remove = useApiMutation((id: string) => del(`${base}/${id}`));
  return (
    <Group title="Ticket types" hint="Bug, feature, chore… Deleting a type just clears it on existing tickets.">
      <div className="flex flex-col gap-1.5">
        {config.ticketTypes.map((t) => (
          <div key={t.id} className={rowCls}>
            <TypeIcon icon={t.icon} color={t.color} /><ColorDot value={t.color} onChange={(color) => upd.mutate({ id: t.id, color })} />
            <input key={t.name} defaultValue={t.name} className={bareInput} onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && upd.mutate({ id: t.id, name: e.target.value.trim() })} aria-label="Type name" />
            <select value={t.icon} onChange={(e) => upd.mutate({ id: t.id, icon: e.target.value })} className="h-7 rounded-sm bg-transparent text-xs text-ink-muted" aria-label="Icon">{TYPE_ICON_NAMES.map((n) => <option key={n}>{n}</option>)}</select>
            <button className="rounded-sm p-1 text-ink-muted hover:text-destructive" aria-label={`Delete ${t.name}`} onClick={() => remove.mutate(t.id)}><Trash2 className="size-3.5" /></button>
          </div>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New type name" className="max-w-xs" /><Button type="submit" size="sm" disabled={!name.trim()}><Plus />Add</Button></form>
    </Group>
  );
}
