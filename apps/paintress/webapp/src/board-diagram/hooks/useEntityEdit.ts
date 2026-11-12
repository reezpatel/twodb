import { useCallback, useState } from "react";
import type { Column } from "@shared/model";
import { newId } from "../../lib/item-store";
import { useDiagramActions } from "../DiagramContext";

/** Business hook: edits to an ERD entity's rows. The whole `columns` array is written back as one patch (= one undo step). */
export function useEntityEdit(itemId: string, columns: Column[], name: string) {
  const actions = useDiagramActions();
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);

  const write = useCallback((cols: Column[], label: string) => actions.patch(itemId, { data: { columns: cols } }, label), [actions, itemId]);

  return {
    canEdit: actions.canEdit,
    editingRow,
    editingName,
    startRow: (id: string) => actions.canEdit && setEditingRow(id),
    stopRow: () => setEditingRow(null),
    startName: () => actions.canEdit && setEditingName(true),
    commitName: (v: string) => {
      setEditingName(false);
      if (v.trim() && v !== name) actions.patch(itemId, { data: { name: v.trim() } }, "Rename table");
    },
    cancelName: () => setEditingName(false),
    updateRow: (id: string, patch: Partial<Column>) => {
      setEditingRow(null);
      write(columns.map((c) => (c.id === id ? { ...c, ...patch } : c)), "Edit column");
    },
    addRow: () => {
      const id = `col_${newId().slice(0, 6)}`;
      write([...columns, { id, name: "new_column", type: "text" }], "Add column");
      setEditingRow(id);
    },
    removeRow: (id: string) => write(columns.filter((c) => c.id !== id), "Remove column"),
    togglePk: (id: string) => write(columns.map((c) => (c.id === id ? { ...c, pk: !c.pk } : c)), "Toggle primary key"),
  };
}
