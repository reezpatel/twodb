import { useCallback, useEffect, useState } from "react";
import type { Board } from "@shared/model";
import { paintressClient } from "../../lib/paintress-client";

/** Holding hook for BoardPage: which kind of board this is, and its name. */
export function useBoardPage(id: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setBoard(null);
    setError(null);
    paintressClient.getBoard(id).then((r) => setBoard(r.board)).catch((e: Error) => setError(e.message));
  }, [id]);
  const rename = useCallback(
    async (name: string) => {
      const b = await paintressClient.updateBoard(id, { name });
      setBoard(b);
    },
    [id],
  );
  return { board, error, rename };
}
