import { useState } from "react";
import type { Board } from "@shared/model";

/** Business hook for BoardRow: inline rename + the hover menu. */
export function useBoardRow(board: Board, onRename: (b: Board, name: string) => Promise<void> | void) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(board.name);
  const [menuOpen, setMenuOpen] = useState(false);

  const commit = async () => {
    setEditing(false);
    const n = name.trim();
    if (n && n !== board.name) await onRename(board, n);
    else setName(board.name);
  };
  const cancel = () => {
    setName(board.name);
    setEditing(false);
  };

  return { editing, name, setName, menuOpen, setMenuOpen, startRename: () => setEditing(true), commit, cancel };
}
