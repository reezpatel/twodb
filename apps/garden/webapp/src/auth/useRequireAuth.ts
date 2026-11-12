import { useEffect, useState } from "react";
import { gateway, getSpace, setSpace } from "../lib/api";

/** Business hook: the shared control-plane session (same-origin cookie) + an initial space. */
export function useRequireAuth() {
  const [state, setState] = useState<"loading" | "ok" | "anonymous">("loading");
  useEffect(() => {
    let alive = true;
    void (async () => {
      const s = await gateway.session().catch(() => null);
      if (!alive) return;
      if (!s?.user) return setState("anonymous");
      if (!getSpace()) {
        const { spaces } = await gateway.spaces().catch(() => ({ spaces: [] }));
        if (spaces[0]) setSpace(spaces[0].id);
      }
      if (alive) setState("ok");
    })();
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
