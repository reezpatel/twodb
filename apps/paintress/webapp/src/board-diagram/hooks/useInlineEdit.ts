import { useCallback, useState } from "react";

/** Business hook: double-click-to-edit state for a text field on a node. */
export function useInlineEdit(current: string, commit: (v: string) => void, enabled = true) {
  const [editing, setEditing] = useState(false);
  const start = useCallback(() => enabled && setEditing(true), [enabled]);
  const onCommit = useCallback(
    (v: string) => {
      setEditing(false);
      if (v !== current) commit(v);
    },
    [current, commit],
  );
  const onCancel = useCallback(() => setEditing(false), []);
  return { editing, start, onCommit, onCancel };
}
