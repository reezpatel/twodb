import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { BoardDto, PinDto } from "../lib/twopin-client.js";
import { useBoards } from "../pins/hooks/useBoards.js";
import { usePins } from "../pins/hooks/usePins.js";
import { navigate } from "../lib/router.js";

/**
 * Shared TwoPin state. Boards + pins are needed both by the shell sidebar
 * (to render the Boards nav group) and by the Boards page (the pin grid), so
 * they live in one provider above both. Selection is driven by the URL hash,
 * not local state, so sidebar and page stay in sync and deep links work.
 */
interface TwoPinState {
  boards: BoardDto[];
  boardsLoading: boolean;
  createBoard: (name: string, description?: string) => Promise<BoardDto>;
  deleteBoard: (id: string) => Promise<void>;
  createBoardOpen: boolean;
  setCreateBoardOpen: (open: boolean) => void;

  // The board currently selected via the URL (undefined = "All pins").
  selectedBoardId: string | undefined;
  selectedBoard: BoardDto | undefined;
  selectBoard: (id: string | undefined) => void;

  pins: PinDto[];
  pinsLoading: boolean;
  pinsError: string | null;
  activeTag: string | undefined;
  setActiveTag: (tag: string | undefined) => void;
  createPin: (input: { boardId: string; url?: string | null; note?: string; title?: string; mediaBase64?: string; mediaContentType?: string }) => Promise<PinDto>;
  updatePin: (id: string, patch: { boardId?: string; title?: string | null; description?: string | null; note?: string | null }) => Promise<PinDto>;
  refreshPin: (id: string) => Promise<PinDto>;
  deletePin: (id: string) => Promise<void>;
}

const Ctx = createContext<TwoPinState | null>(null);

export function TwoPinProvider({ boardId, children }: { boardId: string | undefined; children: ReactNode }) {
  const boards = useBoards();
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);
  const pins = usePins(boardId, activeTag);
  const selectedBoard = boards.boards.find((b) => b.id === boardId);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);

  const createBoard = useCallback(
    async (name: string, description?: string) => {
      const board = await boards.createBoard(name, description);
      navigate(`/boards/${board.id}`);
      return board;
    },
    [boards],
  );

  const selectBoard = useCallback((id: string | undefined) => {
    navigate(id ? `/boards/${id}` : "/boards");
  }, []);

  const deleteBoard = useCallback(
    async (id: string) => {
      await boards.deleteBoard(id);
      if (boardId === id) navigate("/boards");
    },
    [boards, boardId],
  );

  const createPin = useCallback(
    async (input: { boardId: string; url?: string | null; note?: string; title?: string; mediaBase64?: string; mediaContentType?: string }) => {
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

  const value = useMemo<TwoPinState>(
    () => ({
      boards: boards.boards,
      boardsLoading: boards.loading,
      createBoard,
      deleteBoard,
      createBoardOpen,
      setCreateBoardOpen,
      selectedBoardId: boardId,
      selectedBoard,
      selectBoard,
      pins: pins.pins,
      pinsLoading: pins.loading,
      pinsError: pins.error,
      activeTag,
      setActiveTag,
      createPin,
      updatePin: pins.updatePin,
      refreshPin: pins.refreshPin,
      deletePin,
    }),
    [boards, boardId, selectedBoard, selectBoard, deleteBoard, createBoard, createBoardOpen, activeTag, pins, createPin, deletePin],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTwoPin(): TwoPinState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTwoPin must be used within TwoPinProvider");
  return v;
}

