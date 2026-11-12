import { useCallback, useState } from "react";
import type { PinDto } from "../../lib/twopin-client.js";
import { useBoards } from "./useBoards.js";
import { usePins } from "./usePins.js";

/**
 * Holding hook for TwoPinPage — composes the boards/pins business hooks and
 * owns selection + dialog state. The component only calls this hook and
 * renders partials (see blocks/CONVENTIONS.md).
 */
export function useTwoPinPage() {
  const [selectedBoardId, setSelectedBoardId] = useState<string | undefined>(undefined);
  const [addPinOpen, setAddPinOpen] = useState(false);
  const [editingPin, setEditingPin] = useState<PinDto | null>(null);

  const boards = useBoards();
  const pins = usePins(selectedBoardId);

  const selectedBoard = boards.boards.find((b) => b.id === selectedBoardId);

  const selectBoard = useCallback((id: string | undefined) => setSelectedBoardId(id), []);

  const deleteBoard = useCallback(
    async (id: string) => {
      await boards.deleteBoard(id);
      if (selectedBoardId === id) setSelectedBoardId(undefined);
    },
    [boards, selectedBoardId],
  );

  const createPin = useCallback(
    async (input: { boardId: string; url: string; note?: string }) => {
      const pin = await pins.createPin(input);
      await boards.reload(); // pin counts changed
      return pin;
    },
    [pins, boards],
  );

  const deletePin = useCallback(
    async (id: string) => {
      await pins.deletePin(id);
      await boards.reload();
    },
    [pins, boards],
  );

  return {
    boards: boards.boards,
    boardsLoading: boards.loading,
    boardsError: boards.error,
    createBoard: boards.createBoard,
    deleteBoard,
    selectedBoardId,
    selectedBoard,
    selectBoard,
    pins: pins.pins,
    pinsLoading: pins.loading,
    pinsError: pins.error,
    createPin,
    updatePin: pins.updatePin,
    refreshPin: pins.refreshPin,
    deletePin,
    addPinOpen,
    setAddPinOpen,
    editingPin,
    setEditingPin,
  };
}
