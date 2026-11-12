import { Copy, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { CARDINALITIES, EDGE_KINDS, type Item, type ItemPatch } from "@shared/model";
import { GROUP_STYLES, SHAPES } from "@shared/shapes";
import { ColorSwatches } from "./ColorSwatches";
import { CommitInput, Field, Select } from "./Field";

const label = (s: string) => s.replace(/_/g, " ");

/** Right panel: properties of the single selected item. Every change is one patch (= one undo step). */
export function Inspector(props: {
  item: Item;
  disabled: boolean;
  onPatch(patch: ItemPatch, label: string): void;
  onDelete(): void;
  onDuplicate(): void;
  onAddLane(): void;
}) {
  const { item } = props;
  const d = item.data as Record<string, any>;
  const data = (k: string, v: unknown, l = "Edit") => props.onPatch({ data: { [k]: v === "" ? null : v } }, l);
  return (
    <aside className={`absolute bottom-3 right-3 top-16 z-10 flex w-64 flex-col gap-3 overflow-auto rounded-md border border-outline bg-popover p-3 shadow-lg ${props.disabled ? "pointer-events-none opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold capitalize text-ink">{item.type}</span>
        <div className="flex gap-0.5">
          <button type="button" title={item.locked ? "Unlock" : "Lock"} onClick={() => props.onPatch({ locked: !item.locked }, item.locked ? "Unlock" : "Lock")} className="rounded-full p-1.5 text-ink-muted hover:bg-paper-grid">
            {item.locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
          </button>
          <button type="button" title="Duplicate (Ctrl+D)" onClick={props.onDuplicate} className="rounded-full p-1.5 text-ink-muted hover:bg-paper-grid">
            <Copy className="size-4" />
          </button>
          <button type="button" title="Delete" onClick={props.onDelete} className="rounded-full p-1.5 text-destructive hover:bg-paper-grid">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {item.type === "shape" && (
        <>
          <Field label="Text">
            <CommitInput value={d.text ?? ""} onCommit={(v) => data("text", v)} />
          </Field>
          <Field label="Sub-label">
            <CommitInput value={d.sublabel ?? ""} onCommit={(v) => data("sublabel", v)} placeholder="e.g. Node.js 22" />
          </Field>
          <Field label="Icon">
            <CommitInput value={d.icon ?? ""} onCommit={(v) => data("icon", v)} placeholder="logos:aws-lambda" />
          </Field>
          <Field label="Shape">
            <Select
              value={`${d.pack}:${d.shape}`}
              options={SHAPES.map((s) => [`${s.pack}:${s.id}`, `${s.pack} · ${s.label}`] as [string, string])}
              onChange={(v) => {
                const [pack, shape] = v.split(":");
                props.onPatch({ data: { pack, shape } }, "Change shape");
              }}
            />
          </Field>
          <Field label="Fill">
            <ColorSwatches value={d.fill} allowClear onPick={(c) => data("fill", c)} />
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={!!d.dashed} onChange={(e) => data("dashed", e.target.checked ? true : null)} /> Dashed outline
          </label>
        </>
      )}

      {item.type === "group" && (
        <>
          <Field label="Title">
            <CommitInput value={d.title ?? ""} onCommit={(v) => data("title", v, "Rename group")} />
          </Field>
          <Field label="Style">
            <Select
              value={d.kind ?? "plain"}
              options={GROUP_STYLES.map((g) => [g.id, `${g.pack.toUpperCase()} · ${g.label}`] as [string, string])}
              onChange={(v) => {
                const g = GROUP_STYLES.find((x) => x.id === v)!;
                props.onPatch({ data: { kind: g.id, pack: g.pack, icon: g.icon ?? null } }, "Change group style");
              }}
            />
          </Field>
        </>
      )}

      {item.type === "entity" && (
        <>
          <Field label="Table name">
            <CommitInput value={d.name ?? ""} onCommit={(v) => data("name", v, "Rename table")} />
          </Field>
          <div className="text-[11px] text-ink-muted">Double-click a row to edit it. Drag from a row's dot to another table's row to relate them.</div>
        </>
      )}

      {item.type === "pool" && (
        <>
          <Field label="Title">
            <CommitInput value={d.title ?? ""} onCommit={(v) => data("title", v, "Rename pool")} />
          </Field>
          <button type="button" onClick={props.onAddLane} className="flex items-center justify-center gap-1 rounded-full border border-outline py-1 text-[12px] hover:bg-paper-grid">
            <Plus className="size-3.5" /> Add lane
          </button>
        </>
      )}

      {item.type === "lane" && (
        <Field label="Lane title">
          <CommitInput value={d.title ?? ""} onCommit={(v) => data("title", v, "Rename lane")} />
        </Field>
      )}

      {item.type === "sticky" && (
        <>
          <Field label="Text">
            <CommitInput value={d.text ?? ""} onCommit={(v) => data("text", v, "Edit note")} />
          </Field>
          <Field label="Colour">
            <ColorSwatches value={d.color} onPick={(c) => c && data("color", c, "Note colour")} />
          </Field>
        </>
      )}

      {item.type === "text" && (
        <>
          <Field label="Text">
            <CommitInput value={d.text ?? ""} onCommit={(v) => data("text", v)} />
          </Field>
          <Field label="Size">
            <CommitInput type="number" value={String(d.fontSize ?? 16)} onCommit={(v) => Number(v) > 0 && data("fontSize", Number(v))} />
          </Field>
          <Field label="Align">
            <Select value={d.align ?? "left"} options={[["left", "Left"], ["center", "Centre"], ["right", "Right"]]} onChange={(v) => data("align", v)} />
          </Field>
        </>
      )}

      {item.type === "edge" && (
        <>
          <Field label="Label">
            <CommitInput value={d.label ?? ""} onCommit={(v) => data("label", v, "Edit label")} />
          </Field>
          <Field label="Kind">
            <Select value={d.kind ?? "flow"} options={EDGE_KINDS.map((k) => [k, label(k)] as [string, string])} onChange={(v) => data("kind", v, "Change link kind")} />
          </Field>
          <Field label="Routing">
            <Select value={d.routing ?? "orthogonal"} options={[["orthogonal", "Right angles"], ["straight", "Straight"], ["bezier", "Curved"]]} onChange={(v) => data("routing", v)} />
          </Field>
          <Field label="Step number">
            <CommitInput type="number" value={d.step === undefined ? "" : String(d.step)} onCommit={(v) => data("step", v === "" ? null : Number(v), "Set step")} placeholder="none" />
          </Field>
          <Field label="Arrow at end">
            <Select value={d.endCap ?? "arrow"} options={[["arrow", "Arrow"], ["none", "None"]]} onChange={(v) => data("endCap", v)} />
          </Field>
          <Field label="Arrow at start">
            <Select value={d.startCap ?? "none"} options={[["none", "None"], ["arrow", "Arrow"]]} onChange={(v) => data("startCap", v)} />
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={!!d.dashed} onChange={(e) => data("dashed", e.target.checked ? true : null)} /> Dashed
          </label>
          {(d.kind === "relation" || d.cardinality) && (
            <>
              <Field label="Cardinality (from side)">
                <Select value={d.cardinality?.from ?? "zero_or_many"} options={CARDINALITIES.map((c) => [c, label(c)] as [string, string])} onChange={(v) => props.onPatch({ data: { cardinality: { ...(d.cardinality ?? {}), from: v } } }, "Set cardinality")} />
              </Field>
              <Field label="Cardinality (to side)">
                <Select value={d.cardinality?.to ?? "one"} options={CARDINALITIES.map((c) => [c, label(c)] as [string, string])} onChange={(v) => props.onPatch({ data: { cardinality: { ...(d.cardinality ?? {}), to: v } } }, "Set cardinality")} />
              </Field>
            </>
          )}
        </>
      )}
      {item.key && <div className="text-[11px] text-ink-muted">key: <code>{item.key}</code></div>}
    </aside>
  );
}
