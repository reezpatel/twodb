import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@twodb/blocks";
import { artisanClient, type MemoryInfo, type MemoryLevel } from "../../../lib/artisan-client.js";
import { useWorkspaceWs } from "../../../lib/workspace-ws.js";
import { cn } from "../../../lib/cn.js";
import { SideSection } from "./SidePanel.js";

const LEVELS: Array<{ id: MemoryLevel; label: string; hint: string }> = [
  { id: "organization", label: "Global", hint: "Every agent" },
  { id: "code_directory", label: "Directory", hint: "This directory" },
  { id: "self", label: "Agent", hint: "This agent's own" },
  { id: "session", label: "Session", hint: "This session only — survives compaction" },
];
const MEMORY_TOOLS = new Set(["add_memory", "update_memory", "delete_memory"]);

/** What this session's agent sees: titles by level, click to read/edit, plus manual add. */
export function MemoriesSection({ sessionId }: { sessionId: string }) {
  const { onFrame } = useWorkspaceWs();
  const [items, setItems] = useState<MemoryInfo[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    artisanClient.listMemories(sessionId).then(setItems).catch(() => setItems((v) => v ?? []));
  }, [sessionId]);

  useEffect(() => {
    setItems(null);
    setOpen(null);
    setAdding(false);
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  // The agent edits memory mid-run — refresh as soon as one of its memory tools finishes.
  useEffect(() => onFrame((f) => {
    if (f.sessionId === sessionId && f.type === "tool_result" && MEMORY_TOOLS.has(String(f.name))) load();
  }), [onFrame, sessionId, load]);

  const remove = async (m: MemoryInfo) => {
    setItems((v) => v?.filter((x) => x.id !== m.id) ?? v);
    await artisanClient.deleteMemory(m.id).catch((e: Error) => setError(e.message));
    load();
  };

  const groups = LEVELS.map((l) => ({ ...l, rows: (items ?? []).filter((m) => m.level === l.id) })).filter((g) => g.rows.length > 0);

  return (
    <SideSection title="Memories" count={items?.length || undefined}>
      <div className="-mt-1 flex flex-col gap-2">
        {items === null ? <Loader2 className="mx-auto my-2 size-3.5 animate-spin text-ink-muted" /> : null}
        {items && items.length === 0 && !adding ? <p className="text-[12px] text-ink-muted">No memories yet — the agent saves durable facts with add_memory.</p> : null}

        {groups.map((g) => (
          <div key={g.id}>
            <p className="px-1.5 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted" title={g.hint}>{g.label}</p>
            {g.rows.map((m) => (
              <MemoryRow
                key={m.id}
                memory={m}
                open={open === m.id}
                onToggle={() => setOpen(open === m.id ? null : m.id)}
                onDelete={() => void remove(m)}
                onSaved={(u) => setItems((v) => v?.map((x) => (x.id === u.id ? u : x)) ?? v)}
              />
            ))}
          </div>
        ))}

        {adding ? (
          <AddMemory sessionId={sessionId} onCancel={() => setAdding(false)} onCreated={() => { setAdding(false); load(); }} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] text-ink-muted hover:bg-surface-muted/60 hover:text-ink">
            <Plus className="size-3.5" /> Add memory
          </button>
        )}
        {error ? <p className="px-1.5 text-[11px] text-destructive">{error}</p> : null}
      </div>
    </SideSection>
  );
}

function MemoryRow({ memory, open, onToggle, onDelete, onSaved }: {
  memory: MemoryInfo; open: boolean; onToggle: () => void; onDelete: () => void; onSaved: (m: MemoryInfo) => void;
}) {
  const [title, setTitle] = useState(memory.title);
  const [content, setContent] = useState(memory.content);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setTitle(memory.title); setContent(memory.content); }, [memory.title, memory.content]);
  const dirty = title.trim() !== memory.title || content.trim() !== memory.content;

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      onSaved(await artisanClient.updateMemory(memory.id, { title, content }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="group">
      <div className="flex items-center rounded-md hover:bg-surface-muted/60">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1 px-1.5 py-1 text-left text-[12px]">
          {open ? <ChevronDown className="size-3 shrink-0 text-ink-muted" /> : <ChevronRight className="size-3 shrink-0 text-ink-muted" />}
          <span className="truncate">{memory.title}</span>
        </button>
        <button type="button" title="Forget" onClick={onDelete} className="mr-1 hidden rounded p-1 text-ink-muted hover:text-destructive group-hover:block">
          <Trash2 className="size-3" />
        </button>
      </div>
      {open ? (
        <div className="mb-1 ml-4 mt-0.5 flex flex-col gap-1.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-7 rounded-md bg-surface-muted px-2 text-[12px] outline-none focus:ring-1 focus:ring-outline-strong" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={Math.min(10, Math.max(3, content.split("\n").length + 1))} className="resize-y rounded-md bg-surface-muted px-2 py-1.5 text-[12px] leading-snug outline-none focus:ring-1 focus:ring-outline-strong" />
          {err ? <p className="text-[11px] text-destructive">{err}</p> : null}
          {dirty ? (
            <div className="flex gap-1.5">
              <Button size="sm" variant="primary" disabled={saving || !title.trim() || !content.trim()} onClick={() => void save()}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setTitle(memory.title); setContent(memory.content); setErr(null); }}>Reset</Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AddMemory({ sessionId, onCancel, onCreated }: { sessionId: string; onCancel: () => void; onCreated: () => void }) {
  const [level, setLevel] = useState<MemoryLevel>("session");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      await artisanClient.createMemory({ level, title, content, sessionId });
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface-muted/40 p-2">
      <div className="flex flex-wrap gap-1">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            title={l.hint}
            onClick={() => setLevel(l.id)}
            className={cn("rounded-full px-2 py-0.5 text-[11px] transition-colors", level === l.id ? "bg-stone text-ink" : "text-ink-muted hover:bg-surface-muted hover:text-ink")}
          >
            {l.label}
          </button>
        ))}
      </div>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-7 rounded-md bg-surface-muted px-2 text-[12px] outline-none focus:ring-1 focus:ring-outline-strong" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="What to remember" className="resize-y rounded-md bg-surface-muted px-2 py-1.5 text-[12px] leading-snug outline-none focus:ring-1 focus:ring-outline-strong" />
      {err ? <p className="text-[11px] text-destructive">{err}</p> : null}
      <div className="flex gap-1.5">
        <Button size="sm" variant="primary" disabled={busy || !title.trim() || !content.trim()} onClick={() => void create()}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}><X className="size-3" /> Cancel</Button>
      </div>
    </div>
  );
}
