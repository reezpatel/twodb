import { useState, type ReactNode } from "react";
import {
  type Column,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  type SortingState,
  type Updater,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";

/**
 * Generic data table built on @tanstack/react-table.
 *
 * Features:
 * - Block / `table-fixed` layout with explicit column widths
 * - Sortable column headers (click to toggle asc/desc/none; sort indicator on the right)
 * - Resizable column headers via drag handle on the right edge (min size 100, no per-column max)
 * - `user-select: none` on the wrapper while any column is being resized
 * - Horizontal scroll when total column widths exceed the container
 *
 * Columns may declare `accessorKey` / `accessorFn` to become sortable, and
 * `enableResizing: false` to opt out of the resize handle. External state for
 * column order + visibility is supported via the optional `columnOrder` /
 * `columnVisibility` props + change handlers; when omitted, internal state is used.
 */
export interface MockTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  columnOrder?: ColumnOrderState;
  onColumnOrderChange?: (updater: Updater<ColumnOrderState>) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (updater: Updater<VisibilityState>) => void;
  onRowClick?: (row: TData) => void;
  emptyMessage?: ReactNode;
  className?: string;
}

const DEFAULT_MIN_SIZE = 100;
const DEFAULT_SIZE = 200;

export function MockTable<TData>({
  data,
  columns,
  columnOrder: columnOrderProp,
  onColumnOrderChange,
  columnVisibility: columnVisibilityProp,
  onColumnVisibilityChange,
  onRowClick,
  emptyMessage = "No data",
  className,
}: MockTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [internalColumnOrder, setInternalColumnOrder] = useState<ColumnOrderState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>({});

  const columnOrder = columnOrderProp ?? internalColumnOrder;
  const columnVisibility = columnVisibilityProp ?? internalColumnVisibility;
  const handleColumnOrderChange = onColumnOrderChange ?? setInternalColumnOrder;
  const handleColumnVisibilityChange = onColumnVisibilityChange ?? setInternalColumnVisibility;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnSizing, columnOrder, columnVisibility },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: handleColumnOrderChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange",
    defaultColumn: { minSize: DEFAULT_MIN_SIZE, size: DEFAULT_SIZE },
  });

  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();
  const visibleCols = table.getVisibleLeafColumns();
  const visibleCount = visibleCols.length;
  const totalCount = table.getAllColumns().length;
  const isResizing = !!table.getState().columnSizingInfo.isResizingColumn;

  // flexible columns (marked via columnDef.meta.flexible) have no explicit width
  // applied — they absorb extra space when the table is narrower than the
  // container, and shrink first when it is wider.
  const isFlexible = (column: Column<TData, unknown>) => (column.columnDef.meta as { flexible?: boolean } | undefined)?.flexible === true;

  const cellStyle = (column: Column<TData, unknown>, size: number): React.CSSProperties =>
    isFlexible(column) ? { width: "auto", minWidth: 60 } : { width: size, minWidth: (column.columnDef.minSize as number | undefined) ?? 100 };

  return (
    <div data-slot="mock-table" className={cn("relative w-full min-w-0 min-h-0 overflow-auto", isResizing && "select-none", className)}>
      <table className="table-fixed w-full caption-bottom text-sm">
        <colgroup>
          {visibleCols.map((column) => (
            <col key={column.id} style={cellStyle(column, column.getSize())} />
          ))}
        </colgroup>
        <thead className="bg-background sticky top-0 z-10">
          {headerGroups.map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b">
              {headerGroup.headers
                .filter((header) => header.column.getIsVisible())
                .map((header) => {
                  return (
                    <th
                      key={header.id}
                      className={cn("text-muted-foreground relative h-8 px-2 text-left align-middle font-medium tracking-wide")}
                      style={cellStyle(header.column, header.getSize())}
                    >
                      <div className="flex h-full items-center gap-1 overflow-hidden">
                        <span className="min-w-0 flex-1 truncate">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      </div>
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none",
                            "hover:bg-primary/50",
                            header.column.getIsResizing() && "bg-primary",
                          )}
                        />
                      )}
                    </th>
                  );
                })}
            </tr>
          ))}
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {rows.length ? (
            rows.map((row) => (
              <tr
                key={row.id}
                className={cn("border-b transition-colors hover:bg-muted/50", onRowClick && "cursor-pointer")}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="p-2 align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                    style={cellStyle(cell.column, cell.column.getSize())}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={visibleCount || 1} className="text-muted-foreground/70 p-8 text-center text-xs">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {totalCount > visibleCount && (
        <p className="text-muted-foreground/60 px-3 py-1 text-[10px]">
          {visibleCount} of {totalCount} columns visible — open the Columns menu to show more.
        </p>
      )}
    </div>
  );
}
