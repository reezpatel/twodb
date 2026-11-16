import { useEffect, useState } from "react";

/** Business hook: the shared control-plane session (same-origin cookie, resolved by better-auth at the gateway). */
export function useRequireAuth() {
  const [state, setState] = useState<"loading" | "ok" | "anonymous">("loading");
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/get-session", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => alive && setState(s?.session ? "ok" : "anonymous"))
      .catch(() => alive && setState("anonymous"));
    return () => {
      alive = false;
    };
  }, []);
  // No redirect on "anonymous": RequireTwoDbAuth (main.tsx) owns login; bouncing to our own origin loops.
  return state;
}
