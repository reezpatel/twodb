import { useCallback, useEffect, useState } from "react";
import type { Board } from "@shared/model";
import { paintressClient, type Space } from "../../lib/paintress-client";

/** Holding hook for BoardsList. */
export function useBoardsList() {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    paintressClient.listBoards().then((r) => setBoards(r.boards)).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    refresh();
    paintressClient.listSpaces().then((r) => setSpaces(r.spaces)).catch(() => undefined);
  }, [refresh]);

  const create = async (input: { name: string; kind: "diagram" | "doc"; spaceId?: string }) => {
    const b = await paintressClient.createBoard(input);
    refresh();
    return b;
  };
  const rename = async (id: string, name: string) => {
    await paintressClient.updateBoard(id, { name });
    refresh();
  };
  const remove = async (id: string) => {
    await paintressClient.deleteBoard(id);
    refresh();
  };
  return { boards, spaces, error, create, rename, remove };
}
