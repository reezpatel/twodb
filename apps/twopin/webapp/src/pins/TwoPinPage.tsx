import { useTwoPinPage } from "./hooks/useTwoPinPage.js";
import { BoardSidebar } from "./partials/BoardSidebar.js";
import { PinBoardHeader } from "./partials/PinBoardHeader.js";
import { PinGrid } from "./partials/PinGrid.js";
import { AddPinDialog } from "./AddPinDialog.js";
import { EditPinDialog } from "./EditPinDialog.js";

/** TwoPin's main pane: boards sidebar + masonry pin grid. */
export function TwoPinPage() {
  const state = useTwoPinPage();
  return (
    <div className="flex h-full">
      <BoardSidebar
        boards={state.boards}
        loading={state.boardsLoading}
        selectedBoardId={state.selectedBoardId}
        onSelectBoard={state.selectBoard}
        onCreateBoard={state.createBoard}
        onDeleteBoard={state.deleteBoard}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <PinBoardHeader
          board={state.selectedBoard}
          pinCount={state.pins.length}
          onAddPin={() => state.setAddPinOpen(true)}
        />
        <PinGrid
          pins={state.pins}
          loading={state.pinsLoading}
          error={state.pinsError}
          boardSelected={state.selectedBoardId !== undefined || state.boards.length > 0}
          onEditPin={state.setEditingPin}
          onRefreshPin={state.refreshPin}
          onDeletePin={state.deletePin}
          onAddPin={() => state.setAddPinOpen(true)}
        />
      </div>
      <AddPinDialog
        open={state.addPinOpen}
        onOpenChange={state.setAddPinOpen}
        boards={state.boards}
        defaultBoardId={state.selectedBoardId}
        onCreatePin={state.createPin}
      />
      <EditPinDialog
        pin={state.editingPin}
        boards={state.boards}
        onOpenChange={(open) => !open && state.setEditingPin(null)}
        onSave={state.updatePin}
      />
    </div>
  );
}
