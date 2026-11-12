import type { PinDto } from "../../lib/twopin-client.js";
import { PinCard } from "./PinCard.js";
import { PinGridEmptyState } from "./PinGridEmptyState.js";

interface PinGridProps {
  pins: PinDto[];
  loading: boolean;
  error: string | null;
  boardSelected: boolean;
  onEditPin: (pin: PinDto) => void;
  onRefreshPin: (id: string) => Promise<unknown>;
  onDeletePin: (id: string) => Promise<unknown>;
  onAddPin: () => void;
}

/** Dumb partial: masonry layout (CSS columns) over the pin cards. */
export function PinGrid({ pins, loading, error, boardSelected, onEditPin, onRefreshPin, onDeletePin, onAddPin }: PinGridProps) {
  if (loading && pins.length === 0) {
    return <div className="flex flex-1 items-center justify-center p-10 text-sm text-ink-muted">Loading pins…</div>;
  }
  if (error) {
    return <div className="flex flex-1 items-center justify-center p-10 text-sm text-destructive">{error}</div>;
  }
  if (pins.length === 0) {
    return <PinGridEmptyState reason={boardSelected ? "no-pins" : "no-boards"} onAddPin={onAddPin} />;
  }
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 2xl:columns-5">
        {pins.map((pin) => (
          <PinCard key={pin.id} pin={pin} onEdit={onEditPin} onRefresh={onRefreshPin} onDelete={onDeletePin} />
        ))}
      </div>
    </div>
  );
}
