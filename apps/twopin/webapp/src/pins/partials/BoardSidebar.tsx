import { useState } from "react";
import { Button, Input } from "@twodb/blocks";
import { Globe, LayoutGrid, Plus, Trash2 } from "lucide-react";
import type { BoardDto } from "../../lib/twopin-client.js";

interface BoardSidebarProps {
  boards: BoardDto[];
  loading: boolean;
  selectedBoardId: string | undefined;
  onSelectBoard: (id: string | undefined) => void;
  onCreateBoard: (name: string, description?: string) => Promise<BoardDto>;
  onDeleteBoard: (id: string) => Promise<void>;
}

/** Dumb partial: board list sidebar + inline new-board form. */
export function BoardSidebar({ boards, loading, selectedBoardId, onSelectBoard, onCreateBoard, onDeleteBoard }: BoardSidebarProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const totalPins = boards.reduce((sum, b) => sum + b.pinCount, 0);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const board = await onCreateBoard(trimmed);
      setName("");
      setAdding(false);
      onSelectBoard(board.id);
    } finally {
      setBusy(false);
    }
  };

  const itemClass = (active: boolean) =>
    `group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
      active ? "bg-stone font-semibold text-ink" : "text-ink-muted hover:bg-stone/60 hover:text-ink"
    }`;

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-r border-outline p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Boards</span>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setAdding((v) => !v)} aria-label="New board">
          <Plus className="size-3.5" />
        </Button>
      </div>

      {adding && (
        <form
          className="mb-2 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Board name"
            disabled={busy}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
          />
          <Button type="submit" size="sm" disabled={!name.trim() || busy}>
            Add
          </Button>
        </form>
      )}

      <button className={itemClass(selectedBoardId === undefined)} onClick={() => onSelectBoard(undefined)}>
        <Globe className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">All pins</span>
        <span className="text-xs text-ink-muted">{totalPins}</span>
      </button>

      {boards.map((board) => (
        <button key={board.id} className={itemClass(board.id === selectedBoardId)} onClick={() => onSelectBoard(board.id)}>
          <LayoutGrid className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{board.name}</span>
          <span className="text-xs text-ink-muted group-hover:hidden">{board.pinCount}</span>
          <span
            role="button"
            aria-label={`Delete board ${board.name}`}
            className="hidden text-ink-muted hover:text-destructive group-hover:block"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete board "${board.name}" and its ${board.pinCount} pins?`)) void onDeleteBoard(board.id);
            }}
          >
            <Trash2 className="size-3.5" />
          </span>
        </button>
      ))}

      {loading && boards.length === 0 && <p className="px-3 py-2 text-sm text-ink-muted">Loading…</p>}
      {!loading && boards.length === 0 && (
        <p className="px-3 py-2 text-sm text-ink-muted">No boards yet — create one to start pinning.</p>
      )}
    </aside>
  );
}
