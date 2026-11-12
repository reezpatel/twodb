import { useState } from "react";
import { Plus } from "lucide-react";
import type { Row } from "@shared/model";
import type { DatabaseViewModel } from "../hooks/useDatabaseView";
import { CellDisplay } from "../fields/CellDisplay";
import { GroupHeader } from "../partials/GroupHeader";
import { RecordIcon } from "../../ui/RecordIcon";
import { relativeTime } from "../../lib/format";

/** AFFiNE "All docs"-style list: icon, title, preview, properties on the right. */
export function ListView({ m }: { m: DatabaseViewModel }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const props = m.visible.filter((v) => v.field.id !== "title");
  const item = (r: Row) => (
    <button key={r.id} type="button" onClick={() => m.openRow(r.id)} className="group/li flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-ink/[0.04]">
      <RecordIcon icon={r.icon} kind="page" size={17} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[14px] font-medium ${r.title ? "" : "text-ink-muted"}`}>{r.title || "Untitled"}</span>
        {r.preview ? <span className="block truncate text-[12.5px] text-ink-muted">{r.preview.replace(/\s+/g, " ")}</span> : null}
      </span>
      <span className="flex max-w-[55%] shrink-0 items-center justify-end gap-3 overflow-hidden">
        {props.map(({ field }) => {
          if (field.id === "updated_time") return <span key={field.id} className="shrink-0 text-[12px] text-ink-muted">{relativeTime(r.updatedAt)}</span>;
          if (field.id === "created_time") return <span key={field.id} className="shrink-0 text-[12px] text-ink-muted">{relativeTime(r.createdAt)}</span>;
          const v = field.id === "created_by" ? r.createdBy : r.values[field.id];
          if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return null;
          return (
            <span key={field.id} className="flex min-w-0 shrink items-center" title={field.name}>
              <CellDisplay field={field} value={v} relations={m.relations} />
            </span>
          );
        })}
      </span>
    </button>
  );
  const newItem = (values: Record<string, unknown> = {}) => (
    <button type="button" onClick={() => void m.addRow(values, { open: true })} className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-[13px] text-ink-muted hover:bg-ink/[0.04] hover:text-ink">
      <Plus size={15} /> New page
    </button>
  );
  if (m.groups)
    return (
      <div>
        {m.groups.map((g) => (
          <div key={g.key} className="mb-2">
            <GroupHeader group={g} collapsed={collapsed.has(g.key)} onToggle={() => setCollapsed((s) => (s.has(g.key) ? (s.delete(g.key), new Set(s)) : new Set(s.add(g.key))))} />
            {!collapsed.has(g.key) ? (
              <div className="border-t border-outline/70 pt-1">
                {g.rows.map(item)}
                {newItem({ [m.groupField!.id]: g.value })}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  return (
    <div className="border-t border-outline/70 pt-1">
      {m.rows.map(item)}
      {newItem()}
      {!m.rows.length && !m.fetching ? <div className="px-2 py-6 text-center text-[13px] text-ink-muted">No pages {m.search || m.view?.config.filter ? "match this view" : "yet"}</div> : null}
    </div>
  );
}
