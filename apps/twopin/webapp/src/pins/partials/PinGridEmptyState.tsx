import { Pin } from "lucide-react";

interface PinGridEmptyStateProps {
  reason: "no-boards" | "no-pins";
  onAddPin: () => void;
}

/** Dumb partial: empty grid placeholder. */
export function PinGridEmptyState({ reason, onAddPin }: PinGridEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <Pin className="size-10 text-ink-muted" />
      <p className="text-sm text-ink-muted">
        {reason === "no-boards"
          ? "Create a board from the sidebar, then pin your first link."
          : "Nothing pinned here yet."}
      </p>
      {reason === "no-pins" && (
        <button className="text-sm font-semibold text-ion-deep hover:underline" onClick={onAddPin}>
          Pin your first link →
        </button>
      )}
    </div>
  );
}
