import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@twodb/blocks";
import { Group, ColorDot, randomColor, rowCls, bareInput } from "./parts";
import { del, patch, post } from "../../lib/api";
import { useApiMutation } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { selectCls } from "../projects/CreateProjectDialog";
import type { CustomField, FieldType } from "../../lib/types";

export function LabelsSettings() {
  const { project, config } = useProjectCtx();
  const base = `/projects/${project.key}`;
  const [name, setName] = useState(""), [group, setGroup] = useState(""), [gname, setGname] = useState("");
  const add = useApiMutation(() => post(`${base}/labels`, { name, color: randomColor(), groupId: group || null }), { onSuccess: () => setName("") });
  const upd = useApiMutation((v: { id: string } & Record<string, unknown>) => patch(`${base}/labels/${v.id}`, v));
  const remove = useApiMutation((id: string) => del(`${base}/labels/${id}`));
  const addGroup = useApiMutation(() => post(`${base}/label-groups`, { name: gname }), { onSuccess: () => setGname("") });
  const removeGroup = useApiMutation((id: string) => del(`${base}/label-groups/${id}`));
  return (
    <>
      <Group title="Labels" hint="Free-form tags. Put them in groups to keep big sets tidy.">
        <div className="flex flex-col gap-1.5">
          {config.labels.map((l) => (
            <div key={l.id} className={rowCls}>
              <ColorDot value={l.color} onChange={(color) => upd.mutate({ id: l.id, color })} />
              <input key={l.name} defaultValue={l.name} className={bareInput} onBlur={(e) => e.target.value.trim() && e.target.value !== l.name && upd.mutate({ id: l.id, name: e.target.value.trim() })} aria-label="Label name" />
              <select value={l.groupId ?? ""} onChange={(e) => upd.mutate({ id: l.id, groupId: e.target.value || null })} className="h-7 rounded-sm bg-transparent text-xs text-ink-muted" aria-label="Group"><option value="">No group</option>{config.labelGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <button className="rounded-sm p-1 text-ink-muted hover:text-destructive" aria-label={`Delete ${l.name}`} onClick={() => remove.mutate(l.id)}><Trash2 className="size-3.5" /></button>
            </div>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New label" className="max-w-xs" />
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={`${selectCls} w-40`}><option value="">No group</option>{config.labelGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
          <Button type="submit" size="sm" disabled={!name.trim()}><Plus />Add</Button>
        </form>
        {add.error ? <p className="text-sm text-destructive">{(add.error as Error).message}</p> : null}
      </Group>
      <Group title="Label groups">
        <div className="flex flex-wrap gap-2">{config.labelGroups.map((g) => <span key={g.id} className="inline-flex items-center gap-1 rounded-full border border-outline px-3 py-1 text-sm">{g.name}<button aria-label={`Delete group ${g.name}`} className="text-ink-muted hover:text-destructive" onClick={() => removeGroup.mutate(g.id)}><Trash2 className="size-3" /></button></span>)}</div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (gname.trim()) addGroup.mutate(); }}><Input value={gname} onChange={(e) => setGname(e.target.value)} placeholder="New group" className="max-w-xs" /><Button type="submit" size="sm" variant="secondary" disabled={!gname.trim()}><Plus />Add group</Button></form>
      </Group>
    </>
  );
}

function FieldRow({ f, base }: { f: CustomField; base: string }) {
  const [opt, setOpt] = useState("");
  const upd = useApiMutation((v: Record<string, unknown>) => patch(`${base}/custom-fields/${f.id}`, v));
  const remove = useApiMutation(() => del(`${base}/custom-fields/${f.id}`));
  const addOpt = useApiMutation(() => post(`${base}/custom-fields/${f.id}/options`, { label: opt, color: randomColor() }), { onSuccess: () => setOpt("") });
  const delOpt = useApiMutation((id: string) => del(`${base}/custom-fields/${f.id}/options/${id}`));
  const updOpt = useApiMutation((v: { id: string } & Record<string, unknown>) => patch(`${base}/custom-fields/${f.id}/options/${v.id}`, v));
  return (
    <div className="flex flex-col gap-2 rounded-md border border-outline p-3">
      <div className="flex items-center gap-2">
        <input key={f.name} defaultValue={f.name} className={`${bareInput} font-medium`} onBlur={(e) => e.target.value.trim() && e.target.value !== f.name && upd.mutate({ name: e.target.value.trim() })} aria-label="Field name" />
        <span className="rounded-full bg-paper-grid px-2 py-0.5 text-xs text-ink-muted">{f.type}</span>
        <button className="rounded-sm p-1 text-ink-muted hover:text-destructive" aria-label={`Delete ${f.name}`} onClick={() => confirm(`Delete field “${f.name}” and all its values?`) && remove.mutate()}><Trash2 className="size-3.5" /></button>
      </div>
      {f.type === "select" ? (
        <div className="flex flex-wrap items-center gap-2">
          {f.options.map((o) => <span key={o.id} className="inline-flex items-center gap-1.5 rounded-full border border-outline px-2 py-0.5 text-xs"><ColorDot value={o.color} onChange={(color) => updOpt.mutate({ id: o.id, color })} />{o.label}<button aria-label={`Remove ${o.label}`} className="text-ink-muted hover:text-destructive" onClick={() => delOpt.mutate(o.id)}><Trash2 className="size-3" /></button></span>)}
          <form onSubmit={(e) => { e.preventDefault(); if (opt.trim()) addOpt.mutate(); }}><input value={opt} onChange={(e) => setOpt(e.target.value)} placeholder="Add option…" className="h-7 w-32 rounded-sm bg-transparent px-1.5 text-xs outline-none hover:bg-stone focus:bg-stone" /></form>
        </div>
      ) : null}
    </div>
  );
}

export function FieldsSettings() {
  const { project, config } = useProjectCtx();
  const base = `/projects/${project.key}`;
  const [name, setName] = useState(""), [type, setType] = useState<FieldType>("text");
  const add = useApiMutation(() => post(`${base}/custom-fields`, { name, type }), { onSuccess: () => setName("") });
  return (
    <Group title="Custom fields" hint="Extra properties shown on every ticket. A field's type can't be changed after it's created.">
      <div className="flex flex-col gap-2">{config.customFields.map((f) => <FieldRow key={f.id} f={f} base={base} />)}</div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New field name" className="max-w-xs" />
        <select value={type} onChange={(e) => setType(e.target.value as FieldType)} className={`${selectCls} w-36`}>{["text", "number", "date", "select", "checkbox", "url"].map((t) => <option key={t}>{t}</option>)}</select>
        <Button type="submit" size="sm" disabled={!name.trim()}><Plus />Add</Button>
      </form>
    </Group>
  );
}
