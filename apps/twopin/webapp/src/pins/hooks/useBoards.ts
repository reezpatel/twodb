import { useCallback, useEffect, useState } from "react";
import { twopinClient, type BoardDto } from "../../lib/twopin-client.js";

/** Business hook: board list + create/delete. */
export function useBoards() {
  const [boards, setBoards] = useState<BoardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setBoards(await twopinClient.listBoards());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createBoard = useCallback(
    async (name: string, description?: string) => {
      const board = await twopinClient.createBoard({ name, description });
      setBoards((prev) => [...prev, board]);
      return board;
    },
    [],
  );

  const deleteBoard = useCallback(async (id: string) => {
    await twopinClient.deleteBoard(id);
    setBoards((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { boards, loading, error, reload, createBoard, deleteBoard };
}
