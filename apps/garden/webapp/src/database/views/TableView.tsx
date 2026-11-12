import { useState } from "react";
import { Maximize2, Plus, Trash2 } from "lucide-react";
import type { Row } from "@shared/model";
import type { DatabaseViewModel } from "../hooks/useDatabaseView";
import type { RowGroup } from "../lib/view-utils";
import { TableHeaderCell } from "../partials/TableHeaderCell";
import { GroupHeader } from "../partials/GroupHeader";
import { PropertyValue } from "../fields/PropertyValue";
import { AddFieldMenu } from "../fields/AddFieldMenu";
import { Popover } from "../../ui/Popover";
import { RecordIcon } from "../../ui/RecordIcon";
import { newCondition } from "../partials/FilterPopover";

export function TableView({ m }: { m: DatabaseViewModel }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const view = m.view!;
  const cols = m.visible;
  const total = cols.reduce((n, c) => n + c.width, 0) + 44;
  const wrap = !!view.config.wrap;

  const row = (r: Row) => (
    <div key={r.id} className="group/row flex border-b border-outline/70 hover:bg-ink/[0.02]">
      {cols.map((c) => (
        <div key={c.field.id} className="relative shrink-0 border-r border-outline/70 last:border-r-0" style={{ width: c.width }}>
          {c.field.id === "title" ? (
            <div className="flex min-w-0 items-center">
              <span className="pl-2">
                <RecordIcon icon={r.icon} kind="page" size={15} />
              </span>
              <div className="min-w-0 flex-1 font-medium">
                <PropertyValue
                  field={c.field}
                  value={r.title}
                  variant="cell"
                  wrap={wrap}
                  autoEdit={m.editingTitle === r.id}
                  placeholder="Untitled"
                  onChange={(v) => (m.setEditingTitle(null), void m.setValue(r.id, "title", v))}
                />
              </div>
              <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 group-hover/row:opacity-100">
                <button type="button" onClick={() => m.openRow(r.id)} className="flex h-6 items-center gap-1 rounded border border-outline bg-paper px-1.5 text-[11.5px] font-medium text-ink-muted hover:text-ink">
                  <Maximize2 size={11} /> Open
                </button>
                <button type="button" onClick={() => void m.deleteRow(r.id)} className="flex size-6 items-center justify-center rounded border border-outline bg-paper text-ink-muted hover:text-destructive" aria-label="Delete row">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ) : (
            <PropertyValue field={c.field} value={r.values[c.field.id]} relations={m.relations} variant="cell" wrap={wrap} onOpenRecord={m.openRow} onChange={(v) => void m.setValue(r.id, c.field.id, v)} />
          )}
        </div>
      ))}
    </div>
  );

  const newRow = (g?: RowGroup) => (
    <button
      type="button"
      onClick={() => void m.addRow(g && m.groupField ? { [m.groupField.id]: g.value } : {})}
      className="flex h-[34px] w-full items-center gap-1.5 border-b border-outline/70 px-2 text-[13px] text-ink-muted hover:bg-ink/[0.03] hover:text-ink"
    >
      <Plus size={14} /> New page
    </button>
  );

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ minWidth: total }}>
        <div className="flex border-y border-outline/70">
          {cols.map((c) => (
            <TableHeaderCell
              key={c.field.id}
              field={c.field}
              fields={m.fields}
              width={c.width}
              onResize={(w) => void m.setFieldSetting(c.field.id, { width: w })}
              actions={{
                onSort: (direction) => void m.updateConfig({ sorts: [{ fieldId: c.field.id, direction }] }),
                onFilter: () =>
                  void m.updateConfig({
                    filter: { id: view.config.filter?.id ?? crypto.randomUUID(), conjunction: view.config.filter?.conjunction ?? "and", conditions: [...(view.config.filter?.conditions ?? []), newCondition(c.field)] },
                  }),
                onHide: () => void m.setFieldSetting(c.field.id, { hidden: true }),
              }}
            />
          ))}
          <Popover
            open={adding}
            onOpenChange={setAdding}
            align="end"
            trigger={
              <button type="button" className="flex h-[34px] w-[44px] shrink-0 items-center justify-center text-ink-muted hover:bg-ink/[0.04] hover:text-ink" aria-label="Add property">
                <Plus size={15} />
              </button>
            }
          >
            <AddFieldMenu databaseId={view.databaseId} onCreated={(f) => (setAdding(false), void m.setFieldSetting(f.id, { hidden: false }))} />
          </Popover>
        </div>
        {m.groups
          ? m.groups.map((g) => (
              <div key={g.key} className="mt-3">
                <GroupHeader
                  group={g}
                  collapsed={collapsed.has(g.key)}
                  onToggle={() => setCollapsed((s) => (s.has(g.key) ? (s.delete(g.key), new Set(s)) : new Set(s.add(g.key))))}
                  onAdd={() => void m.addRow({ [m.groupField!.id]: g.value })}
                />
                {!collapsed.has(g.key) ? (
                  <div className="border-t border-outline/70">
                    {g.rows.map(row)}
                    {newRow(g)}
                  </div>
                ) : null}
              </div>
            ))
          : (
            <>
              {m.rows.map(row)}
              {newRow()}
            </>
          )}
        <div className="px-2 pt-1.5 text-[12px] text-ink-muted">
          {m.total} {m.total === 1 ? "page" : "pages"}
        </div>
      </div>
    </div>
  );
}
