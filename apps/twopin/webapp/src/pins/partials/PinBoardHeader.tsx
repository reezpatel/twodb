import { Button } from "@twodb/blocks";
import { Plus } from "lucide-react";
import type { BoardDto } from "../../lib/twopin-client.js";

interface PinBoardHeaderProps {
  board: BoardDto | undefined;
  pinCount: number;
  onAddPin: () => void;
}

/** Dumb partial: title bar above the pin grid. */
export function PinBoardHeader({ board, pinCount, onAddPin }: PinBoardHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-outline px-5 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold text-ink">{board ? board.name : "All pins"}</h1>
        <p className="truncate text-sm text-ink-muted">
          {board?.description ?? `${pinCount} pin${pinCount === 1 ? "" : "s"}`}
        </p>
      </div>
      <Button onClick={onAddPin} size="sm">
        <Plus className="size-4" /> Add pin
      </Button>
    </header>
  );
}
