import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ListFilter,
} from "lucide-react";
import { IconButton } from "./IconButton";
import { Menu, MenuItem } from "./Menu";
import { SearchInput } from "./SearchInput";
import { Select } from "./Select";

export interface DataColumn<T> {
  id: string;
  label: string;
  cell: (row: T) => ReactNode;
  /** Enables sorting when provided. */
  sortValue?: (row: T) => string | number;
  /** Enables a header filter menu when provided. */
  filterOptions?: { value: string; label: string }[];
  /** Row value matched against the active filter; falls back to sortValue. */
  filterValue?: (row: T) => string;
  align?: "left" | "right";
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
  "aria-label"?: string;
}

type SortDir = "asc" | "desc";

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchText,
  searchPlaceholder = "Search…",
  pageSize: initialPageSize = 8,
  pageSizeOptions = [8, 16, 32],
  emptyMessage = "Nothing here yet.",
  "aria-label": ariaLabel = "Data table",
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ id: string; dir: SortDir } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const visible = useMemo(() => {
    let out = rows;

    const q = query.trim().toLowerCase();
    if (q && searchText) {
      out = out.filter((row) => searchText(row).toLowerCase().includes(q));
    }

    for (const col of columns) {
      const active = filters[col.id];
      if (!active || !col.filterOptions) continue;
      const get = col.filterValue ?? col.sortValue;
      if (get) out = out.filter((row) => String(get(row)) === active);
    }

    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sortValue) {
        const get = col.sortValue;
        out = [...out].sort((a, b) => {
          const va = get(a);
          const vb = get(b);
          const cmp =
            typeof va === "number" && typeof vb === "number"
              ? va - vb
              : String(va).localeCompare(String(vb));
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }

    return out;
  }, [rows, query, filters, sort, columns, searchText]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const from = visible.length === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(visible.length, (safePage + 1) * pageSize);

  function cycleSort(col: DataColumn<T>) {
    setPage(0);
    setSort((cur) => {
      if (!cur || cur.id !== col.id) return { id: col.id, dir: "asc" };
      if (cur.dir === "asc") return { id: col.id, dir: "desc" };
      return null;
    });
  }

  function setFilter(colId: string, value: string) {
    setPage(0);
    setFilters((cur) => {
      const next = { ...cur };
      if (value) next[colId] = value;
      else delete next[colId];
      return next;
    });
  }

  return (
    <div className="tw-table-wrap">
      {searchText ? (
        <div className="tw-datatable__toolbar">
          <SearchInput
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
      ) : null}

      <div className="tw-table-scroll">
        <table className="tw-table" aria-label={ariaLabel}>
          <thead className="tw-thead">
            <tr className="tw-tr">
              {columns.map((col) => {
                const sorted = sort?.id === col.id ? sort.dir : null;
                const filterActive = !!filters[col.id];
                return (
                  <th
                    key={col.id}
                    className={["tw-th", col.align === "right" ? "tw-th--right" : ""]
                      .filter(Boolean)
                      .join(" ")}
                    aria-sort={
                      sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined
                    }
                  >
                    <span className="tw-th__inner">
                      {col.sortValue ? (
                        <button
                          type="button"
                          className={["tw-th__sort", sorted ? "tw-th__sort--active" : ""]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => cycleSort(col)}
                        >
                          {col.label}
                          {sorted === "asc" ? (
                            <ArrowUp aria-hidden="true" />
                          ) : sorted === "desc" ? (
                            <ArrowDown aria-hidden="true" />
                          ) : (
                            <ArrowUpDown aria-hidden="true" />
                          )}
                        </button>
                      ) : (
                        col.label
                      )}
                      {col.filterOptions ? (
                        <Menu
                          placement="bottom-start"
                          trigger={
                            <IconButton
                              size="sm"
                              label={`Filter ${col.label}`}
                              icon={<ListFilter />}
                              className={[
                                "tw-th__filter",
                                filterActive ? "tw-th__filter--active" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            />
                          }
                        >
                          <MenuItem
                            icon={!filterActive ? <Check /> : <span style={{ width: 15 }} />}
                            onClick={() => setFilter(col.id, "")}
                          >
                            All
                          </MenuItem>
                          {col.filterOptions.map((opt) => (
                            <MenuItem
                              key={opt.value}
                              icon={
                                filters[col.id] === opt.value ? (
                                  <Check />
                                ) : (
                                  <span style={{ width: 15 }} />
                                )
                              }
                              onClick={() => setFilter(col.id, opt.value)}
                            >
                              {opt.label}
                            </MenuItem>
                          ))}
                        </Menu>
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="tw-tbody">
            {pageRows.map((row) => (
              <tr className="tw-tr" key={rowKey(row)}>
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={["tw-td", col.align === "right" ? "tw-td--right" : ""]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {pageRows.length === 0 ? <div className="tw-datatable__empty">{emptyMessage}</div> : null}
      </div>

      <div className="tw-datatable__footer">
        <span className="tw-tnum">
          {from}–{to} of {visible.length}
        </span>
        <div className="tw-datatable__pager">
          <div className="tw-datatable__pagesize">
            <Select
              aria-label="Rows per page"
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(0);
              }}
              options={pageSizeOptions.map((n) => ({ value: String(n), label: `${n} rows` }))}
            />
          </div>
          <IconButton
            size="sm"
            variant="secondary"
            label="Previous page"
            icon={<ChevronLeft />}
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          />
          <span className="tw-tnum">
            {safePage + 1} / {pageCount}
          </span>
          <IconButton
            size="sm"
            variant="secondary"
            label="Next page"
            icon={<ChevronRight />}
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          />
        </div>
      </div>
    </div>
  );
}
