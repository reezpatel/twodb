import { useEffect, useRef, useState, type ReactNode } from "react";
import {
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
 * Div-based data grid built on @tanstack/react-table (headless — it computes
 * rows/columns/sizing; rendering here is plain flex divs, not <table>).
 *
 * Layout: every row is a flex row of fixed-width cells (px from the column
 * sizing). The grid's own width = sum of column widths; when it's narrower
 * than the container, the container paints a border-aligned gradient so the
 * grid reads as extending to the container edge — no fake filler column.
 *
 * Features:
 * - Sortable column headers (click to toggle asc/desc/none)
 * - Resizable column headers via drag handle on the right edge
 * - Sticky header (top offset via `stickyHeaderTop`) and sticky footer
 * - meta.sticky start/end columns
 * - role=grid/row/gridcell for a11y
 */
export interface DataGridTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  columnOrder?: ColumnOrderState;
  onColumnOrderChange?: (updater: Updater<ColumnOrderState>) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (updater: Updater<VisibilityState>) => void;
  onRowClick?: (row: TData) => void;
  emptyMessage?: ReactNode;
  className?: string;
  /** Sticky footer block rendered below the rows (e.g. add-row + counts). */
  footer?: ReactNode;
  /** Live column sizes (px after resize) — the footer/summary rows subscribe
   * so their cells track column resizing. */
  onColumnSizing?: (sizing: { id: string; size: number }[]) => void;
  /** CSS top for the sticky header — set to the tab bar height when the grid
   * lives in a page-scrolled layout. */
  stickyHeaderTop?: number | string;
  rowHeightClass?: string;
}

const DEFAULT_MIN_SIZE = 100;
const DEFAULT_SIZE = 200;

export function DataGridTable<TData>({
  data,
  columns,
  columnOrder: columnOrderProp,
  onColumnOrderChange,
  columnVisibility: columnVisibilityProp,
  onColumnVisibilityChange,
  onRowClick,
  emptyMessage = "No data",
  className,
  footer,
  onColumnSizing,
  stickyHeaderTop,
  rowHeightClass = "h-8",
}: DataGridTableProps<TData>) {
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

  // Live per-column px sizes (after resizes) for footer/summary consumers.
  useEffect(() => {
    onColumnSizing?.(visibleCols.map((col) => ({ id: col.id, size: col.getSize() })));
  }, [onColumnSizing, visibleCols.map((c) => `${c.id}:${c.getSize()}`).join(",")]);

  const cellWidth = (column: { getSize: () => number; columnDef: { minSize?: number } }): React.CSSProperties => ({
    width: column.getSize(),
    minWidth: column.columnDef.minSize ?? DEFAULT_MIN_SIZE,
    flexShrink: 0,
  });

  const stickyStyle = (columnDef: ColumnDef<TData, unknown>): React.CSSProperties => {
    const sticky = (columnDef.meta as { sticky?: "start" | "end" } | undefined)?.sticky;
    if (sticky === "start") return { position: "sticky", left: 0, zIndex: 2, background: "var(--color-background)" };
    if (sticky === "end") return { position: "sticky", right: 0, zIndex: 2, background: "var(--color-background)" };
    return {};
  };

  // Grid width = sum of visible column widths.
  const gridWidth = visibleCols.reduce((sum, col) => sum + Math.max(col.getSize(), col.columnDef.minSize ?? DEFAULT_MIN_SIZE), 0);

  // Container width — measured live so the grid knows whether it spills.
  // Narrow (grid ≤ container): border groups span the full container — the
  // table reads as extending to the edge, no trailing pad needed.
  // Spilling (grid > container): border groups stop at gridWidth and rows
  // keep pr-32 breathing room at the scroll end.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const spills = containerWidth > 0 && gridWidth > containerWidth;

  /** Inner border-group width: full container when narrow, grid width when
   *  spilling (the outer row supplies the pr-32 tail in that case). */
  const groupStyle: React.CSSProperties = spills ? { width: gridWidth } : { flex: 1 };

  // rows stretch to the container width when narrower; when the grid spills,
  // trailing padding (pr-32) keeps breathing room at the scroll end. The
  // bottom borders live on inner groups sized to gridWidth so they stop
  // before the padding zone.

  const headerRow = (headerGroup: (typeof headerGroups)[number]) => (
    <div key={headerGroup.id} role="row" className={cn("bg-background flex w-max min-w-full", spills && "pr-32")}>
      <div className="flex border-b" style={groupStyle}>
        {headerGroup.headers
          .filter((header) => header.column.getIsVisible())
          .map((header, index, headers) => (
            <div
              key={header.id}
              role="columnheader"
              className={cn(
                "text-muted-foreground relative h-8 shrink-0 px-2 text-left text-xs font-medium tracking-wide",
                index < headers.length - 1 && "border-r",
                (header.column.columnDef.meta as { sticky?: string } | undefined)?.sticky && "border-l",
              )}
              style={{ ...cellWidth(header.column), ...stickyStyle(header.column.columnDef) }}
            >
              <div className="flex h-full items-center gap-1 overflow-hidden">
                <span className="min-w-0 flex-1 truncate">{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</span>
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
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} className={cn("relative flex min-h-0 flex-col", isResizing && "select-none", className)}>
      {/* header — sticky below the tab bar when stickyHeaderTop is set; the
          page scroller is the sticky ancestor */}
      <div
        className={cn("bg-background z-10", stickyHeaderTop !== undefined && "sticky")}
        style={stickyHeaderTop !== undefined ? { top: stickyHeaderTop } : undefined}
      >
        {headerGroups.map(headerRow)}
      </div>

      {/* rows — flex rows sized identically to the header. Cells sit in an
          inner group sized to the grid width; the row's bottom border lives
          on that group so it stops before the pr-32 padding zone. */}
      <div role="grid" className="flex flex-col">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.id}
              role="row"
              className={cn("hover:bg-muted/50 flex w-max min-w-full transition-colors group/row", spills && "pr-32", onRowClick && "cursor-pointer")}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              <div className="flex border-b" style={groupStyle}>
                {row.getVisibleCells().map((cell, index, cells) => (
                  <div
                    key={cell.id}
                    role="gridcell"
                    className={cn(
                      "flex items-center overflow-hidden px-2 align-middle text-xs whitespace-nowrap",
                      rowHeightClass,
                      index < cells.length - 1 && "border-r",
                      (cell.column.columnDef.meta as { sticky?: string } | undefined)?.sticky && "border-l",
                      row.getIsSelected?.() && "bg-muted/50",
                    )}
                    style={{ ...cellWidth(cell.column), ...stickyStyle(cell.column.columnDef) }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div role="row" className={cn("flex w-max min-w-full", spills && "pr-32")}>
            <div className="flex border-b" style={groupStyle}>
              <div role="gridcell" className="text-muted-foreground/70 p-8 text-center text-xs" style={{ flex: 1 }}>
                {emptyMessage}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer — sticky to the page scroller's bottom (visible during
          vertical scroll); horizontally it flows with the grid. Sticky
          affordances inside (e.g. add-row button) still float on h-scroll. */}
      {footer && (
        <div
          className={cn("bg-background sticky bottom-0 z-10 w-max min-w-full", spills && "pr-32")}
          style={spills ? { minWidth: `max(100%, ${gridWidth + 128}px)` } : undefined}
        >
          <div style={spills ? { width: gridWidth } : undefined}>{footer}</div>
        </div>
      )}

      {totalCount > visibleCount && (
        <p className="text-muted-foreground/60 px-3 py-1 text-[10px]">
          {visibleCount} of {totalCount} columns visible — open the Columns menu to show more.
        </p>
      )}
    </div>
  );
}
