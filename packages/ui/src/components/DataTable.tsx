import { useEffect, useMemo, useRef, useState, memo, useCallback, type ReactNode } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type PaginationState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Plus,
  X,
} from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { Input } from "./Input";
import { SearchInput } from "./SearchInput";
import { Select } from "./Select";
import { CellEditor, CellView, type CellOption, type CellType } from "./cells";
import { ColumnConfig } from "./ColumnConfig";

export type FilterSpec =
  | { kind: "text" }
  | { kind: "number" }
  | { kind: "enum"; options: { value: string; label: string }[] };

export interface DataColumn<T> {
  id: string;
  label: string;
  /** Custom display renderer. Omit to use the type's default renderer. */
  cell?: (row: T) => ReactNode;
  /** Enables sorting when provided. */
  sortValue?: (row: T) => string | number;
  /** Enables the column in the filter builder. */
  filter?: FilterSpec;
  /** Raw row value for filtering; falls back to sortValue. */
  filterValue?: (row: T) => string | number;
  align?: "left" | "right";
  /** Initial column width in px — columns are resizable. */
  width?: number;
  /** Cell type drives the default display renderer and the inline editor. */
  type?: CellType;
  /** Options for select / multiselect / chips columns. */
  options?: CellOption[];
  /** Raw cell value for the default renderer and editor. */
  editValue?: (row: T) => unknown;
  /** Writes an edited value back into the row; enables cell editing. */
  setValue?: (row: T, value: unknown) => T;
}

export interface FilterRule {
  id: string;
  columnId: string;
  op: string;
  value: string;
}

type Combinator = "and" | "or";

const OPERATORS: Record<FilterSpec["kind"], { value: string; label: string }[]> = {
  text: [
    { value: "contains", label: "contains" },
    { value: "is", label: "is" },
    { value: "isNot", label: "is not" },
  ],
  number: [
    { value: "eq", label: "equals" },
    { value: "neq", label: "does not equal" },
    { value: "gt", label: "more than" },
    { value: "lt", label: "less than" },
  ],
  enum: [
    { value: "is", label: "is" },
    { value: "isNot", label: "is not" },
  ],
};

function evalRule<T>(row: T, col: DataColumn<T>, rule: FilterRule): boolean {
  const get = col.filterValue ?? col.sortValue;
  if (!get || !col.filter) return true;
  const raw = get(row);

  switch (col.filter.kind) {
    case "text": {
      const a = String(raw).toLowerCase();
      const b = rule.value.toLowerCase();
      if (rule.op === "contains") return a.includes(b);
      if (rule.op === "is") return a === b;
      if (rule.op === "isNot") return a !== b;
      return true;
    }
    case "number": {
      const a = Number(raw);
      const b = Number(rule.value);
      if (Number.isNaN(a) || Number.isNaN(b)) return true;
      if (rule.op === "eq") return a === b;
      if (rule.op === "neq") return a !== b;
      if (rule.op === "gt") return a > b;
      if (rule.op === "lt") return a < b;
      return true;
    }
    case "enum": {
      const match = String(raw) === rule.value;
      return rule.op === "isNot" ? !match : match;
    }
  }
}

interface FilterState {
  query: string;
  combinator: Combinator;
  rules: FilterRule[];
  searchText?: (row: unknown) => string;
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Enables the toolbar search; maps a row to its searchable text. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyMessage?: string;
  /** Enables click-to-edit cells for columns that define editValue + setValue. */
  editable?: boolean;
  /** Called with the full row array after any cell edit commits. */
  onRowsChange?: (rows: T[]) => void;
  "aria-label"?: string;
}

let ruleSeq = 0;
const nextRuleId = () => `rule-${++ruleSeq}`;

/* --- Memoized row: an edit re-renders exactly one row --- */

interface DataRowProps<T> {
  row: T;
  rowId: string;
  columns: DataColumn<T>[];
  editable: boolean;
  editingColId: string | null;
  onStartEdit: (rowId: string, colId: string) => void;
  onCommit: (rowId: string, col: DataColumn<T>, value: unknown) => void;
  onCancelEdit: () => void;
}

const DataRowInner = memo(function DataRowInner<T>({
  row,
  rowId,
  columns,
  editable,
  editingColId,
  onStartEdit,
  onCommit,
  onCancelEdit,
}: DataRowProps<T>) {
  return (
    <tr className="tw-tr">
      {columns.map((col) => {
        const editableCell = editable && !!col.setValue && !!col.editValue;
        const isEditing = editingColId === col.id;
        return (
          <td
            key={col.id}
            className={[
              "tw-td",
              col.align === "right" ? "tw-td--right" : "",
              editableCell ? "tw-td--editable" : "",
              isEditing ? "tw-td--editing" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={editableCell && !isEditing ? () => onStartEdit(rowId, col.id) : undefined}
          >
            {isEditing ? (
              <CellEditor
                type={col.type ?? "text"}
                value={col.editValue!(row)}
                options={col.options}
                onCommit={(v) => onCommit(rowId, col, v)}
                onClose={onCancelEdit}
              />
            ) : col.cell ? (
              col.cell(row)
            ) : (
              <CellView
                type={col.type ?? "text"}
                value={col.editValue ? col.editValue(row) : undefined}
                options={col.options}
              />
            )}
          </td>
        );
      })}
    </tr>
  );
}) as <T>(props: DataRowProps<T>) => ReactNode;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchText,
  searchPlaceholder = "Search…",
  pageSize: initialPageSize = 8,
  pageSizeOptions = [8, 16, 32],
  emptyMessage = "Nothing here yet.",
  editable = false,
  onRowsChange,
  "aria-label": ariaLabel = "Data table",
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [combinator, setCombinator] = useState<Combinator>("and");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersAnchorRef = useRef<HTMLDivElement>(null);

  /* --- editable cells: one editor at a time; typing never touches table state --- */
  const [draft, setDraft] = useState(rows);
  const [editing, setEditing] = useState<{ rowId: string; colId: string } | null>(null);

  useEffect(() => setDraft(rows), [rows]);

  const handleStartEdit = useCallback((rowId: string, colId: string) => {
    setEditing({ rowId, colId });
  }, []);

  const handleCancelEdit = useCallback(() => setEditing(null), []);

  const handleCommit = useCallback(
    (rowId: string, col: DataColumn<T>, value: unknown) => {
      if (!col.setValue) return;
      setDraft((cur) => {
        const next = cur.map((r) => (rowKey(r) === rowId ? col.setValue!(r, value) : r));
        onRowsChange?.(next);
        return next;
      });
      /* multiselect commits incrementally and stays open */
      if (col.type !== "multiselect" && col.type !== "chips") setEditing(null);
    },
    [rowKey, onRowsChange]
  );

  const filterable = useMemo(() => columns.filter((c) => c.filter), [columns]);

  /* --- filter predicate over the whole row (search + rules) --- */
  const rulesFilter = useMemo(
    () => (row: Row<T>, _columnId: string, state: FilterState) => {
      if (state.query && state.searchText) {
        const text = state.searchText(row.original as T).toLowerCase();
        if (!text.includes(state.query)) return false;
      }
      const active = state.rules.filter((r) => r.columnId && r.op && r.value !== "");
      if (active.length === 0) return true;
      const results = active.map((rule) => {
        const col = columns.find((c) => c.id === rule.columnId);
        return col ? evalRule(row.original as T, col, rule) : true;
      });
      return state.combinator === "and" ? results.every(Boolean) : results.some(Boolean);
    },
    [columns]
  );

  const columnDefs = useMemo<ColumnDef<T, unknown>[]>(
    () =>
      columns.map((col) => ({
        id: col.id,
        header: col.label,
        accessorFn: (row: T) => col.sortValue?.(row) ?? "",
        size: col.width ?? 160,
        enableSorting: !!col.sortValue,
        enableResizing: true,
      })),
    [columns]
  );

  const globalFilter: FilterState = {
    query: query.trim().toLowerCase(),
    combinator,
    rules,
    searchText: searchText as ((row: unknown) => string) | undefined,
  };

  const table = useReactTable({
    data: draft,
    columns: columnDefs,
    state: { sorting, pagination, globalFilter },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: rulesFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
    getRowId: (row) => rowKey(row),
  });

  /* --- close the filter panel on outside click / Escape --- */
  useEffect(() => {
    if (!filtersOpen) return;
    const onPointerDown = (e: globalThis.MouseEvent) => {
      if (!filtersAnchorRef.current?.contains(e.target as Node)) setFiltersOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  const activeRuleCount = rules.filter((r) => r.columnId && r.op && r.value !== "").length;

  function cycleSort(colId: string) {
    setSorting((cur) => {
      if (cur[0]?.id !== colId) return [{ id: colId, desc: false }];
      return cur[0].desc ? [] : [{ id: colId, desc: true }];
    });
  }

  function addRule() {
    const first = filterable[0];
    if (!first) return;
    setRules((cur) => [
      ...cur,
      { id: nextRuleId(), columnId: first.id, op: OPERATORS[first.filter!.kind][0].value, value: "" },
    ]);
  }

  function updateRule(id: string, patch: Partial<FilterRule>) {
    setRules((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const leafRows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <div className="tw-table-wrap">
      {searchText || filterable.length > 0 ? (
        <div className="tw-datatable__toolbar">
          {searchText ? (
            <SearchInput
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : null}
          {filterable.length > 0 ? (
            <div className="tw-filterpop-anchor" ref={filtersAnchorRef}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFiltersOpen((o) => !o)}
                aria-expanded={filtersOpen}
              >
                <ListFilter size={14} aria-hidden="true" />
                Filters
                {activeRuleCount > 0 ? (
                  <Badge size="sm" tone="go">
                    {activeRuleCount}
                  </Badge>
                ) : null}
              </Button>

              {filtersOpen ? (
                <div className="tw-filterpop" role="dialog" aria-label="Filter builder">
                  <div className="tw-filterpop__head">
                    <span className="tw-cue">Show rows that</span>
                    <div style={{ width: 132 }}>
                      <Select
                        aria-label="Filter combination"
                        value={combinator}
                        onValueChange={(v) => setCombinator(v as Combinator)}
                        options={[
                          { value: "and", label: "match all" },
                          { value: "or", label: "match any" },
                        ]}
                      />
                    </div>
                  </div>

                  {rules.map((rule) => {
                    const col = columns.find((c) => c.id === rule.columnId);
                    const spec = col?.filter;
                    return (
                      <div className="tw-filterpop__rule" key={rule.id}>
                        <Select
                          aria-label="Field"
                          value={rule.columnId}
                          onValueChange={(columnId) => {
                            const next = columns.find((c) => c.id === columnId);
                            updateRule(rule.id, {
                              columnId,
                              op: next?.filter ? OPERATORS[next.filter.kind][0].value : "",
                              value: "",
                            });
                          }}
                          options={filterable.map((c) => ({ value: c.id, label: c.label }))}
                        />
                        <Select
                          aria-label="Operator"
                          value={rule.op}
                          onValueChange={(op) => updateRule(rule.id, { op })}
                          options={spec ? OPERATORS[spec.kind] : []}
                        />
                        {spec?.kind === "enum" ? (
                          <Select
                            aria-label="Value"
                            placeholder="Pick…"
                            value={rule.value}
                            onValueChange={(value) => updateRule(rule.id, { value })}
                            options={spec.options}
                          />
                        ) : (
                          <Input
                            aria-label="Value"
                            type={spec?.kind === "number" ? "number" : "text"}
                            placeholder="Value…"
                            value={rule.value}
                            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                          />
                        )}
                        <IconButton
                          size="sm"
                          label="Remove filter"
                          icon={<X />}
                          onClick={() => setRules((cur) => cur.filter((r) => r.id !== rule.id))}
                        />
                      </div>
                    );
                  })}

                  <div className="tw-filterpop__foot">
                    <Button size="sm" variant="ghost" onClick={addRule}>
                      <Plus size={14} aria-hidden="true" />
                      Add filter
                    </Button>
                    {rules.length > 0 ? (
                      <Button size="sm" variant="ghost" onClick={() => setRules([])}>
                        Clear all
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="tw-table-scroll">
        <table
          className="tw-table tw-table--data"
          aria-label={ariaLabel}
          style={{ width: table.getTotalSize(), minWidth: "100%" }}
        >
          <thead className="tw-thead">
            {table.getHeaderGroups().map((hg) => (
              <tr className="tw-tr" key={hg.id}>
                {hg.headers.map((header) => {
                  const col = columns.find((c) => c.id === header.column.id);
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      className={["tw-th", col?.align === "right" ? "tw-th--right" : ""]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ width: header.getSize() }}
                      aria-sort={
                        sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined
                      }
                    >
                      <span className="tw-th__inner">
                        {canSort ? (
                          <button
                            type="button"
                            className={["tw-th__sort", sorted ? "tw-th__sort--active" : ""]
                              .filter(Boolean)
                              .join(" ")}
                            onClick={() => cycleSort(header.column.id)}
                          >
                            {header.column.columnDef.header as string}
                            {sorted === "asc" ? (
                              <ArrowUp aria-hidden="true" />
                            ) : sorted === "desc" ? (
                              <ArrowDown aria-hidden="true" />
                            ) : (
                              <ArrowUpDown aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          (header.column.columnDef.header as string)
                        )}
                        <ColumnConfig label={header.column.columnDef.header as string} type={col?.type ?? "text"} />
                      </span>
                      {header.column.getCanResize() ? (
                        <span
                          className={[
                            "tw-col-resize",
                            header.column.getIsResizing() ? "tw-col-resize--active" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => header.column.resetSize()}
                        />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="tw-tbody">
            {leafRows.map((row) => (
              <DataRowInner
                key={row.id}
                row={row.original as T}
                rowId={row.id}
                columns={columns}
                editable={editable}
                editingColId={editing?.rowId === row.id ? editing.colId : null}
                onStartEdit={handleStartEdit}
                onCommit={handleCommit}
                onCancelEdit={handleCancelEdit}
              />
            ))}
          </tbody>
        </table>
        {leafRows.length === 0 ? <div className="tw-datatable__empty">{emptyMessage}</div> : null}
      </div>

      <div className="tw-datatable__footer">
        <span className="tw-tnum">
          {from}–{to} of {total}
        </span>
        <div className="tw-datatable__pager">
          <div className="tw-datatable__pagesize">
            <Select
              aria-label="Rows per page"
              value={String(pageSize)}
              onValueChange={(v) =>
                setPagination({ pageIndex: 0, pageSize: Number(v) })
              }
              options={pageSizeOptions.map((n) => ({ value: String(n), label: `${n} rows` }))}
            />
          </div>
          <IconButton
            size="sm"
            variant="secondary"
            label="Previous page"
            icon={<ChevronLeft />}
            disabled={pageIndex === 0}
            onClick={() => table.previousPage()}
          />
          <span className="tw-tnum">
            {pageIndex + 1} / {pageCount}
          </span>
          <IconButton
            size="sm"
            variant="secondary"
            label="Next page"
            icon={<ChevronRight />}
            disabled={pageIndex >= pageCount - 1}
            onClick={() => table.nextPage()}
          />
        </div>
      </div>
    </div>
  );
}
