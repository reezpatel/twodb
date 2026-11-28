import { useState } from "react";
import type { PinDto } from "../lib/twopin-client.js";
import { useTwoPin } from "../state/TwoPinProvider.js";
import { usePageHeader } from "../shell/usePageHeader.js";
import { PinGrid } from "../pins/partials/PinGrid.js";
import { TagFilterBar } from "../pins/partials/TagFilterBar.js";
import { AddPinDialog } from "../pins/AddPinDialog.js";
import { EditPinDialog } from "../pins/EditPinDialog.js";
import { PinDetailDialog } from "../pins/PinDetailDialog.js";
import { CreateBoardDialog } from "./CreateBoardDialog.js";

/** Boards page: masonry pin grid for the selected board (or all pins). */
export function BoardsPage() {
  const tp = useTwoPin();
  const [addPinOpen, setAddPinOpen] = useState(false);
  const [editingPin, setEditingPin] = useState<PinDto | null>(null);
  const [viewingPin, setViewingPin] = useState<PinDto | null>(null);

  usePageHeader({
    title: tp.selectedBoard ? tp.selectedBoard.name : "All pins",
    subtitle: tp.selectedBoard?.description ?? `${tp.pins.length} pin${tp.pins.length === 1 ? "" : "s"}`,
    actionLabel: "Add pin",
    onAction: () => setAddPinOpen(true),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TagFilterBar activeTag={tp.activeTag} onSelect={tp.setActiveTag} />
      <PinGrid
        pins={tp.pins}
        loading={tp.pinsLoading}
        error={tp.pinsError}
        boardSelected={tp.selectedBoardId !== undefined || tp.boards.length > 0}
        onOpenPin={setViewingPin}
        onEditPin={setEditingPin}
        onRefreshPin={tp.refreshPin}
        onDeletePin={tp.deletePin}
        onAddPin={() => setAddPinOpen(true)}
      />
      <PinDetailDialog pin={viewingPin} onOpenChange={(open) => !open && setViewingPin(null)} />
      <AddPinDialog
        open={addPinOpen}
        onOpenChange={setAddPinOpen}
        boards={tp.boards}
        defaultBoardId={tp.selectedBoardId}
        onCreatePin={tp.createPin}
      />
      <EditPinDialog
        pin={editingPin}
        boards={tp.boards}
        onOpenChange={(open) => !open && setEditingPin(null)}
        onSave={tp.updatePin}
      />
      <CreateBoardDialog />
    </div>
  );
}

