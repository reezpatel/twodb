import { FileText, Network, Trash2 } from "lucide-react";
import type { Board } from "@shared/model";

export function BoardCard(props: { board: Board; spaceName?: string; onOpen(): void; onDelete(): void }) {
  const { board } = props;
  const Icon = board.kind === "doc" ? FileText : Network;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={props.onOpen}
      onKeyDown={(e) => e.key === "Enter" && props.onOpen()}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-md border border-outline bg-stone p-4 transition-colors hover:border-ion-deep"
    >
      <div className="flex h-24 items-center justify-center rounded-sm border border-outline bg-paper">
        <Icon className="size-8 text-ink-muted" />
      </div>
      <div>
        <div className="truncate font-semibold text-ink">{board.name}</div>
        <div className="text-xs text-ink-muted">
          {board.kind === "doc" ? "Markdown doc" : "Diagram"}
          {props.spaceName ? ` · ${props.spaceName}` : ""} · {new Date(board.updatedAt).toLocaleDateString()}
        </div>
      </div>
      <button
        aria-label={`Delete ${board.name}`}
        onClick={(e) => {
          e.stopPropagation();
          props.onDelete();
        }}
        className="absolute right-2 top-2 hidden rounded-full p-1.5 text-ink-muted hover:bg-paper-grid group-hover:block"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
