import { useEffect, useMemo, useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { CellDisplayFor, CellEditFor } from "@/components/ui/property-cell";
import { MockTable } from "@/components/ui/mock-table";
import { ColumnControls, type ColumnOption } from "./column-controls";
import { ColumnMenu } from "./column-menu";
import type { NoteProperty, NoteRecord, NotesViewHook } from "./use-notes-view";

const PREVIEW_COLUMN_ID = "preview";
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
}: {
  notes: NoteRecord[];
  columns: NoteProperty[];
  view: NotesViewHook;
  setOpenNoteId: (id: string | null) => void;
  onAddProperty: () => void;
}) {
  const insertProperty = (side: "left" | "right", pivotId: string) => {
    void view.addProperty.mutateAsync({ name: "New property", type: "text" }).then((row) => {
      if (side === "right") {
        const idx = columns.findIndex((c) => c.id === pivotId);
        if (idx === -1) return;
        const newOrder = [...columns.map((c) => c.id).slice(0, idx + 1), row.id, ...columns.map((c) => c.id).slice(idx + 1)];
        setColumnOrder(newOrder);
      } else {
        const idx = columns.findIndex((c) => c.id === pivotId);
        if (idx <= 0) return;
        const newOrder = [...columns.map((c) => c.id).slice(0, idx), row.id, ...columns.map((c) => c.id).slice(idx)];
        setColumnOrder(newOrder);
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
        id: PREVIEW_COLUMN_ID,
        accessorFn: (note) => note.preview ?? "",
        header: "Preview",
        size: 256,
        cell: ({ row }) => (
          <button type="button" className="text-left text-xs" onClick={() => setOpenNoteId(row.original.noteId)}>
            <span className="block max-w-60 truncate">{row.original.preview || "(empty)"}</span>
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
      {
        id: ADD_PROPERTY_COLUMN_ID,
        meta: { flexible: true },
        enableHiding: false,
        enableSorting: false,
        enableResizing: false,
        size: 60,
        header: () => (
          <button
            type="button"
            onClick={onAddProperty}
            className="hover:bg-accent text-muted-foreground hover:text-foreground flex h-full w-full items-center justify-center rounded text-xs"
            title="Add property"
          >
            <Plus size={13} />
          </button>
        ),
        cell: () => null,
      },
    ],
    [columns, view, setOpenNoteId, onAddProperty],
  );

  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // sync columnOrder whenever the set of column ids changes: preserve user
  // reordering for ids that still exist, append any new ids to the tail, and
  // keep the "+" add-column pinned to the very end.
  useEffect(() => {
    const currentIds = tableColumns.map((c) => c.id as string);
    setColumnOrder((prev) => {
      const filtered = prev.filter((id) => currentIds.includes(id));
      const additions = currentIds.filter((id) => !prev.includes(id));
      let next = additions.length === 0 && filtered.length === prev.length ? prev : [...filtered, ...additions];
      if (next.includes(ADD_PROPERTY_COLUMN_ID) && next[next.length - 1] !== ADD_PROPERTY_COLUMN_ID) {
        next = [...next.filter((id) => id !== ADD_PROPERTY_COLUMN_ID), ADD_PROPERTY_COLUMN_ID];
      }
      return next;
    });
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

  const columnOptions = useMemo<ColumnOption[]>(
    () => [
      { id: PREVIEW_COLUMN_ID, label: "Preview" },
      ...columns.map((prop) => ({ id: prop.id, label: prop.name })),
      { id: UPDATED_COLUMN_ID, label: "Updated" },
    ],
    [columns],
  );

  return (
    <div className="flex flex-col w-full overflow-hidden">
      <div className="border-b flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <span className="text-muted-foreground/70 text-[11px] font-semibold tracking-wide uppercase">Table</span>
        <ColumnControls
          columns={columnOptions}
          columnOrder={columnOrder}
          columnVisibility={columnVisibility}
          onColumnOrderChange={setColumnOrder}
          onColumnVisibilityChange={setColumnVisibility}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <MockTable
          data={notes}
          columns={tableColumns}
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          emptyMessage='No notes yet — hit "Note" to create the first one.'
          className="min-h-0 flex-1 "
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
