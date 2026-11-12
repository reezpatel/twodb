import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Checkbox } from "@twodb/blocks";
import { Section, addBtn } from "./Section";
import { ProgressBar } from "../../components/Visuals";
import { useProjectCtx } from "../../lib/project-context";
import type { Checklist, TicketDetail } from "../../lib/types";
import type { TicketPageApi } from "./useTicketPage";

function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  return <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } }}><input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="w-full rounded-sm bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-ink-muted hover:bg-stone focus:bg-stone" /></form>;
}

function ChecklistCard({ c, api }: { c: Checklist; api: TicketPageApi }) {
  const done = c.items.filter((i) => i.done).length;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-outline p-3">
      <div className="flex items-center gap-2">
        <input defaultValue={c.title} key={c.title} onBlur={(e) => e.target.value.trim() && e.target.value !== c.title && api.checklist.rename.mutate({ id: c.id, title: e.target.value.trim() })} className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none" />
        <span className="text-xs text-ink-muted">{done}/{c.items.length}</span>
        <button aria-label="Delete checklist" className="rounded-sm p-1 text-ink-muted hover:bg-paper-grid hover:text-destructive" onClick={() => api.checklist.remove.mutate(c.id)}><Trash2 className="size-3.5" /></button>
      </div>
      {c.items.length ? <ProgressBar done={done} total={c.items.length} /> : null}
      {c.items.map((i) => (
        <div key={i.id} className="group flex items-center gap-2 rounded-sm px-1 py-0.5 hover:bg-stone">
          <Checkbox checked={i.done} onCheckedChange={(v) => api.checklist.updateItem.mutate({ id: i.id, done: v === true })} />
          <input defaultValue={i.text} key={i.text} onBlur={(e) => e.target.value.trim() && e.target.value !== i.text && api.checklist.updateItem.mutate({ id: i.id, text: e.target.value.trim() })} className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${i.done ? "text-ink-muted line-through" : ""}`} />
          <button aria-label="Remove item" className="hidden rounded-sm p-0.5 text-ink-muted group-hover:block hover:text-destructive" onClick={() => api.checklist.removeItem.mutate(i.id)}><X className="size-3.5" /></button>
        </div>
      ))}
      <AddInput placeholder="Add an item…" onAdd={(text) => api.checklist.addItem.mutate({ checklistId: c.id, text })} />
    </div>
  );
}

export function ChecklistsPanel({ t, api }: { t: TicketDetail; api: TicketPageApi }) {
  const { project } = useProjectCtx();
  const [adding, setAdding] = useState(false);
  if (!project.checklistsEnabled) return null;
  return (
    <Section title="Checklists" count={t.checklists.length} action={<button className={addBtn} onClick={() => setAdding(true)}><Plus className="size-3" />Add</button>}>
      {t.checklists.map((c) => <ChecklistCard key={c.id} c={c} api={api} />)}
      {adding ? <AddInput placeholder="Checklist title, press Enter" onAdd={(title) => { api.checklist.add.mutate(title); setAdding(false); }} /> : null}
    </Section>
  );
}
