import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";

/** Row peek (AFFiNE's centered peek view) lives in the URL: ?peek=<recordId>. */
export function usePeek() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const peekId = params.get("peek");
  const openPeek = useCallback(
    (id: string) =>
      setParams((p) => {
        const n = new URLSearchParams(p);
        n.set("peek", id);
        return n;
      }),
    [setParams],
  );
  const closePeek = useCallback(
    () =>
      setParams((p) => {
        const n = new URLSearchParams(p);
        n.delete("peek");
        return n;
      }),
    [setParams],
  );
  const openFull = useCallback((id: string) => navigate(`/${id}`), [navigate]);
  return { peekId, openPeek, closePeek, openFull };
}
