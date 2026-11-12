import { useMemo, useState } from "react";
import type { Field, Row, View, ViewConfig } from "@shared/model";
import { useDatabase, useGarden, useMembers, useRows } from "../../lib/queries";
import { usePeek } from "../../lib/usePeek";
import { groupRows, moveGroupValue, prefillFromFilter, viewFields, withFieldSetting, type RowGroup } from "../lib/view-utils";

/**
 * Holding hook behind DatabaseView (full page and inline block): database
 * schema, the active view, its rows (server-filtered/sorted), grouping, and
 * every mutation the views need.
 */
export function useDatabaseView(databaseId: string, viewId: string | null, onViewChange?: (id: string) => void) {
  const garden = useGarden();
  const db = useDatabase(databaseId);
  const members = useMembers().data?.members ?? [];
  const { openPeek } = usePeek();
  const [search, setSearch] = useState("");
  const [localView, setLocalView] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);

  const views = db.data?.views ?? [];
  const fields = db.data?.fields ?? [];
  const view: View | undefined = views.find((v) => v.id === (viewId ?? localView)) ?? views[0];
  const rowsQuery = useRows(view ? databaseId : null, { viewId: view?.id, search: search || undefined, limit: 2000 });
  const rows = rowsQuery.data?.rows ?? [];
  const relations = rowsQuery.data?.relations ?? {};

  const vfields = useMemo(() => (view ? viewFields(view, fields) : []), [view, fields]);
  const visible = useMemo(() => vfields.filter((v) => !v.hidden), [vfields]);
  const groupField = view?.config.groupBy ? fields.find((f) => f.id === view.config.groupBy!.fieldId) : undefined;
  const groups: RowGroup[] | null = useMemo(() => {
    if (!view || !groupField) return null;
    const g = groupRows(rows, groupField, members);
    return view.config.groupBy?.hideEmpty ? g.filter((x) => x.rows.length > 0) : g;
  }, [rows, groupField, view, members]);

  const selectView = (id: string) => (onViewChange ? onViewChange(id) : setLocalView(id));
  const updateConfig = (patch: Partial<ViewConfig>) => view && garden.patchView(databaseId, view.id, { config: { ...view.config, ...patch } });

  return {
    loading: db.isLoading,
    error: db.error,
    database: db.data?.database,
    fields,
    views,
    view,
    vfields,
    visible,
    rows,
    total: rowsQuery.data?.total ?? 0,
    fetching: rowsQuery.isFetching,
    relations,
    groupField,
    groups,
    search,
    setSearch,
    editingTitle,
    setEditingTitle,
    selectView,
    updateConfig,
    openRow: openPeek,
    setFieldSetting: (fieldId: string, patch: { hidden?: boolean; width?: number }) => view && garden.patchView(databaseId, view.id, { config: withFieldSetting(view, fields, fieldId, patch) }),
    setValue: (rowId: string, fieldId: string, value: unknown) => garden.setValues(rowId, { [fieldId]: value }),
    async addRow(values: Record<string, unknown> = {}, opts: { open?: boolean; title?: string } = {}) {
      const page = await garden.createPage({ parentId: databaseId, title: opts.title ?? "", values: { ...prefillFromFilter(view?.config.filter, fields), ...values } });
      if (opts.open) openPeek(page.id);
      else setEditingTitle(page.id);
      return page;
    },
    moveToGroup(row: Row, from: RowGroup | undefined, to: RowGroup) {
      if (!groupField || from?.key === to.key) return;
      return garden.setValues(row.id, { [groupField.id]: moveGroupValue(groupField, row.values[groupField.id], from, to) });
    },
    deleteRow: (id: string) => garden.trash(id),
    async createView(type: View["type"], name: string) {
      const v = await garden.createView(databaseId, { name, type });
      selectView(v.id);
    },
    garden,
  };
}

export type DatabaseViewModel = ReturnType<typeof useDatabaseView>;
export type { Field };
