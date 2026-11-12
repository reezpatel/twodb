import { useCallback } from "react";
import { useDiagramActions } from "../DiagramContext";
import { useInlineEdit } from "./useInlineEdit";

/** Business hook: double-click to edit an edge's label in place. */
export function useEdgeLabel(itemId: string, label: string) {
  const actions = useDiagramActions();
  const commit = useCallback(
    (v: string) => actions.patch(itemId, { data: { label: v.trim() ? v.trim() : null } }, "Edit label"),
    [actions, itemId],
  );
  return useInlineEdit(label, commit, actions.canEdit);
}
