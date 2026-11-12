import { useCallback, useRef, useState } from "react";
import type { Op } from "@shared/model";

export interface HistoryEntry {
  label: string;
  /** Ops that revert (undo stack) or re-apply (redo stack) one batch. */
  ops: Op[];
}

const LIMIT = 100;

/**
 * Business hook: undo/redo stacks. Every entry is a batch's `inverse` as
 * reported by the server, so human edits and AI edits undo the same way.
 */
export function useHistory() {
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const [, bump] = useState(0);
  const touch = () => bump((n) => n + 1);

  const record = useCallback((entry: HistoryEntry) => {
    if (!entry.ops.length) return;
    undoStack.current = [...undoStack.current, entry].slice(-LIMIT);
    redoStack.current = [];
    touch();
  }, []);
  const pushRedo = useCallback((entry: HistoryEntry) => {
    if (!entry.ops.length) return;
    redoStack.current = [...redoStack.current, entry].slice(-LIMIT);
    touch();
  }, []);
  const pushUndo = useCallback((entry: HistoryEntry) => {
    if (!entry.ops.length) return;
    undoStack.current = [...undoStack.current, entry].slice(-LIMIT);
    touch();
  }, []);
  const takeUndo = useCallback(() => {
    const e = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    touch();
    return e;
  }, []);
  const takeRedo = useCallback(() => {
    const e = redoStack.current[redoStack.current.length - 1];
    redoStack.current = redoStack.current.slice(0, -1);
    touch();
    return e;
  }, []);
  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    touch();
  }, []);

  return {
    record,
    pushRedo,
    pushUndo,
    takeUndo,
    takeRedo,
    clear,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    undoLabel: undoStack.current[undoStack.current.length - 1]?.label,
    redoLabel: redoStack.current[redoStack.current.length - 1]?.label,
  };
}
