import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { FileText, Plus } from "lucide-react";
import { CellDisplayFor, CellEditFor } from "@/components/ui/property-cell";
import { DataGridTable } from "@/components/ui/data-grid-table";
import { ColumnMenu } from "./column-menu";
import type { NoteProperty, NoteRecord, NotesViewHook } from "./use-notes-view";
import { cn } from "@/lib/utils";

/** Notion "Name" column — the row page's title. */
const NAME_COLUMN_ID = "name";
const UPDATED_COLUMN_ID = "updated";
const ADD_PROPERTY_COLUMN_ID = "__add_property__";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function TableView({
  notes,
  columns,
  view,
  setOpenNoteId,
  onAddProperty,
  columnOrder,
  columnVisibility,
  onColumnOrderChange,
  onColumnVisibilityChange,
}: {
  notes: NoteRecord[];
  columns: NoteProperty[];
  view: NotesViewHook;
  setOpenNoteId: (id: string | null) => void;
  onAddProperty: () => void;
  /** Column order/visibility owned by the parent view bar (shared across views). */
  columnOrder: string[];
  columnVisibility: VisibilityState;
  onColumnOrderChange: (updater: string[] | ((prev: string[]) => string[])) => void;
  onColumnVisibilityChange: (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => void;
}) {
  // New row — creates an empty note (same as the toolbar "Note" button).
  const addRow = () => view.createNote.mutate({});

  const insertProperty = (side: "left" | "right", pivotId: string) => {
    void view.addProperty.mutateAsync({ name: "New property", type: "text" }).then((row) => {
      if (side === "right") {
        const idx = columns.findIndex((c) => c.id === pivotId);
        if (idx === -1) return;
        const newOrder = [...columns.map((c) => c.id).slice(0, idx + 1), row.id, ...columns.map((c) => c.id).slice(idx + 1)];
        onColumnOrderChange(newOrder);
      } else {
        const idx = columns.findIndex((c) => c.id === pivotId);
        if (idx <= 0) return;
        const newOrder = [...columns.map((c) => c.id).slice(0, idx), row.id, ...columns.map((c) => c.id).slice(idx)];
        onColumnOrderChange(newOrder);
      }
    });
  };

  const [activeEdit, setActiveEdit] = useState<{
    noteId: string;
    columnId: string;
    value: unknown;
    prop: NoteProperty;
    rect: DOMRect;
  } | null>(null);

  // Optimistic per-(note, column) values so the cell reflects the user's
  // selection the instant they click an option in the floating editor —
  // doesn't have to wait for the PATCH → refetch round-trip.
  const [optimisticValues, setOptimisticValues] = useState<Record<string, unknown>>({});
  const optimisticKey = (noteId: string, columnId: string) => `${noteId}:${columnId}`;

  const tableColumns = useMemo<ColumnDef<NoteRecord, unknown>[]>(
    () => [
      {
        id: NAME_COLUMN_ID,
        accessorFn: (note) => note.title ?? "",
        header: "Name",
        size: 256,
        // whole cell opens the row page (side editor on desktop)
        cell: ({ row }) => (
          <button
            type="button"
            className="flex h-full w-full items-center gap-1.5 text-left text-[13px] font-medium"
            onClick={() => setOpenNoteId(row.original.noteId)}
          >
            <FileText size={13} className="text-muted-foreground/60 shrink-0" aria-hidden="true" />
            <span className={cn("truncate", !row.original.title && "text-muted-foreground/60 font-normal")}>{row.original.title || "Untitled"}</span>
          </button>
        ),
      },
      ...columns.map<ColumnDef<NoteRecord, unknown>>((prop) => ({
        id: prop.id,
        header: ({ column }) => <ColumnMenu column={column} prop={prop} view={view} onInsertColumn={(side) => insertProperty(side, prop.id)} />,
        cell: ({ row }) => {
          const optKey = optimisticKey(row.original.noteId, prop.id);
          const value = optKey in optimisticValues ? optimisticValues[optKey] : row.original.props[prop.id];
          return (
            <CellDisplayFor
              value={value}
              prop={prop}
              onActivate={(rect) =>
                setActiveEdit({
                  noteId: row.original.noteId,
                  columnId: prop.id,
                  value: row.original.props[prop.id],
                  prop,
                  rect,
                })
              }
              onCommit={(value) => view.updateNote.mutate({ noteId: row.original.noteId, props: { [prop.id]: value } })}
            />
          );
        },
      })),
      {
        id: UPDATED_COLUMN_ID,
        accessorFn: (note) => note.updatedAt,
        header: "Updated",
        size: 80,
        cell: ({ row }) => <span className="text-muted-foreground text-xs">{relativeTime(row.original.updatedAt)}</span>,
      },
      // add-column strip — plain fixed-width cell, always last. Hidden when
      // the schema is locked by an app/feature (e.g. shared_content).
      ...(view.schemaLockedBy
        ? []
        : [
            {
              id: ADD_PROPERTY_COLUMN_ID,
              enableHiding: false,
              enableSorting: false,
              enableResizing: false,
              size: 44,
              header: () => (
                <button
                  type="button"
                  onClick={onAddProperty}
                  className="hover:bg-accent text-muted-foreground hover:text-foreground flex h-full w-full items-center justify-center text-xs"
                  title="Add property"
                >
                  <Plus size={13} />
                </button>
              ),
              cell: () => null,
            } satisfies ColumnDef<NoteRecord, unknown>,
          ]),
    ],
    [columns, view, setOpenNoteId, onAddProperty],
  );

  // sync columnOrder whenever the set of column ids changes: preserve user
  // reordering for ids that still exist, append any new ids to the tail, and
  // keep the "+" add-column pinned to the very end. (Order/visibility state
  // lives in the parent view bar so all views share it.)
  useEffect(() => {
    const currentIds = tableColumns.map((c) => c.id as string);
    onColumnOrderChange(
      (() => {
        const prev = columnOrder;
        const filtered = prev.filter((id) => currentIds.includes(id));
        const additions = currentIds.filter((id) => !prev.includes(id));
        let next = additions.length === 0 && filtered.length === prev.length ? prev : [...filtered, ...additions];
        if (next.includes(ADD_PROPERTY_COLUMN_ID) && next[next.length - 1] !== ADD_PROPERTY_COLUMN_ID) {
          next = [...next.filter((id) => id !== ADD_PROPERTY_COLUMN_ID), ADD_PROPERTY_COLUMN_ID];
        }
        return next;
      })(),
    );
  }, [tableColumns]);

  // Keep the editor's `prop` in sync with the latest `columns` so that newly
  // added / edited options mid-session show up in the open editor.
  useEffect(() => {
    if (!activeEdit) return;
    const latestProp = columns.find((c) => c.id === activeEdit.columnId);
    if (latestProp && latestProp !== activeEdit.prop) {
      setActiveEdit((prev) => (prev ? { ...prev, prop: latestProp } : null));
    }
  }, [columns, activeEdit]);

  // Live column sizes from the grid (post-resize) — the summary/count row
  // subscribes so its cells track column resizing.
  const [liveSizes, setLiveSizes] = useState<Record<string, number>>({});
  const handleColumnSizing = useCallback((sizes: { id: string; size: number }[]) => {
    setLiveSizes(Object.fromEntries(sizes.map((s) => [s.id, s.size])));
  }, []);

  // Per-column count of non-empty cells, aligned to the visible column order
  // (checkbox true / non-null / non-undefined counts as filled). Width fields
  // mirror the grid's cellStyle so the count row stays column-aligned.
  const countRow = useMemo(() => {
    const cellFilled = (colId: string, note: NoteRecord): boolean => {
      if (colId === NAME_COLUMN_ID) return Boolean(note.title?.trim());
      if (colId === UPDATED_COLUMN_ID) return true;
      if (colId === ADD_PROPERTY_COLUMN_ID) return false;
      const prop = columns.find((c) => c.id === colId);
      if (prop?.type === "checkbox") return note.props[colId] === true;
      const v = note.props[colId];
      return v !== null && v !== undefined && String(v).trim() !== "";
    };
    const byId = new Map(tableColumns.map((c) => [c.id as string, c]));
    return columnOrder
      .filter((id) => byId.has(id) && (columnVisibility[id] !== false || id === ADD_PROPERTY_COLUMN_ID))
      .map((id) => ({
        id,
        size: liveSizes[id] ?? ((byId.get(id)!.size as number | undefined) ?? 200),
        minWidth: ((byId.get(id)!.minSize as number | undefined) ?? 100),
        count: notes.filter((n) => cellFilled(id, n)).length,
      }));
  }, [columnOrder, columnVisibility, tableColumns, columns, notes, liveSizes]);

  return (
    <div className="flex w-full flex-col overflow-visible px-4 pt-4 lg:px-32">
      {/* Table area — the grid spills horizontally with the page; the header
          sticks below the tab bar, the footer (New + counts) to the bottom. */}
      <div className="flex flex-col">
        <DataGridTable
          data={notes}
          columns={tableColumns}
          columnOrder={columnOrder}
          onColumnOrderChange={onColumnOrderChange}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={onColumnVisibilityChange}
          onColumnSizing={handleColumnSizing}
          emptyMessage='No notes yet — hit "Note" to create the first one.'
          stickyHeaderTop={36}
          rowHeightClass="h-9"
          footer={
            <div className="bg-background w-full">
              {/* New — the row spans the grid; the button itself is
                  sticky-left so it floats in place during horizontal scroll */}
              <div className="border-y">
                <button
                  type="button"
                  onClick={addRow}
                  disabled={view.createNote.isPending}
                  className="bg-background hover:bg-accent text-muted-foreground hover:text-foreground sticky left-32 z-10 flex h-8 w-44 items-center gap-1.5 px-2 text-left text-xs"
                  title="Add row"
                >
                  <Plus size={13} /> New
                </button>
              </div>
              {/* summary — grid-aligned count cells; widths track column
                  resizes via liveSizes */}
              <div className="flex border-b">
                {countRow.map((col) => (
                  <div
                    key={col.id}
                    className={cn(
                      "text-muted-foreground/70 flex h-7 shrink-0 items-center overflow-hidden px-2 text-[11px] tabular-nums",
                      col.id !== ADD_PROPERTY_COLUMN_ID && "border-r",
                    )}
                    style={{ width: col.size, minWidth: col.minWidth }}
                    title={`${col.count} filled`}
                  >
                    {col.id === ADD_PROPERTY_COLUMN_ID ? "" : col.count}
                  </div>
                ))}
              </div>
            </div>
          }
        />
      </div>
      {activeEdit && (
        <CellEditFor
          value={activeEdit.value}
          prop={activeEdit.prop}
          position={{ x: activeEdit.rect.left, y: activeEdit.rect.top - 8 }}
          size={{ width: activeEdit.rect.width + 30, minHeight: activeEdit.rect.height + 10 }}
          onCommit={(value) => {
            // Optimistic update so the cell reflects the selection immediately,
            // before the PATCH → refetch round-trip completes.
            const optKey = optimisticKey(activeEdit.noteId, activeEdit.columnId);
            setOptimisticValues((prev) => ({ ...prev, [optKey]: value }));
            view.updateNote.mutate({ noteId: activeEdit.noteId, props: { [activeEdit.columnId]: value } });
            setActiveEdit(null);
          }}
          onClose={() => setActiveEdit(null)}
          onPropChange={(updatedProp) => {
            console.log("[table-view] onPropChange", { id: updatedProp.id, type: updatedProp.type, optionCount: updatedProp.options?.length ?? 0 });
            if (updatedProp.type === "select" || updatedProp.options !== undefined) {
              view.setPropertyOptions.mutate(
                { id: updatedProp.id, options: updatedProp.options ?? [] },
                {
                  onError: (err) => console.error("[table-view] setPropertyOptions FAILED", err),
                },
              );
            }
          }}
        />
      )}
    </div>
  );
}
