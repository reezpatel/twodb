import type { ReactNode } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Board } from "@shared/model";
import { useBoardRow } from "../hooks/useBoardRow";

export interface BoardRowProps {
  board: Board;
  active: boolean;
  onOpen(b: Board): void;
  onRename(b: Board, name: string): Promise<void> | void;
  onDelete(b: Board): Promise<void> | void;
}

/** One board in the sidebar: click to open, hover menu for rename / delete. */
export function BoardRow(props: BoardRowProps) {
  const r = useBoardRow(props.board, props.onRename);

  if (r.editing) {
    return (
      <input
        autoFocus
        value={r.name}
        aria-label="Board name"
        className="my-0.5 h-7 w-full rounded-md bg-surface-muted px-2 text-[13px] outline-none"
        onChange={(e) => r.setName(e.target.value)}
        onBlur={() => void r.commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void r.commit();
          if (e.key === "Escape") r.cancel();
        }}
      />
    );
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded-[8px] pl-2.5 pr-1 font-sans text-[13px] font-light transition-colors ${
        props.active ? "bg-stone text-ink" : "text-muted-foreground hover:bg-paper-grid hover:text-ink"
      }`}
    >
      <button type="button" onClick={() => props.onOpen(props.board)} className="min-w-0 flex-1 truncate py-[7px] text-left leading-none" title={props.board.name}>
        {props.board.name}
      </button>
      <div className="relative shrink-0">
        <button
          type="button"
          title="Board options"
          aria-label="Board options"
          className={`rounded-sm p-0.5 text-ink-muted/60 hover:bg-surface-muted hover:text-ink ${r.menuOpen ? "" : "opacity-0 group-hover:opacity-100"}`}
          onClick={() => r.setMenuOpen((v: boolean) => !v)}
        >
          <MoreHorizontal className="size-3.5" />
        </button>
        {r.menuOpen ? (
          <>
            <div className="fixed inset-0 z-40" onMouseDown={() => r.setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border border-outline bg-surface p-1 shadow-lg">
              <MenuItem
                icon={<Pencil className="size-3.5" />}
                label="Rename"
                onClick={() => {
                  r.setMenuOpen(false);
                  r.startRename();
                }}
              />
              <MenuItem
                icon={<Trash2 className="size-3.5" />}
                label="Delete"
                danger
                onClick={() => {
                  r.setMenuOpen(false);
                  if (window.confirm(`Delete "${props.board.name}"?`)) void props.onDelete(props.board);
                }}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function MenuItem(props: { icon: ReactNode; label: string; danger?: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] ${
        props.danger ? "text-destructive hover:bg-destructive/10" : "text-ink hover:bg-paper-grid"
      }`}
    >
      {props.icon}
      {props.label}
    </button>
  );
}
