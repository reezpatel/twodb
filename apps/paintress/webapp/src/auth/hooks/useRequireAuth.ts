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
  useEffect(() => {
    // No login of our own: bounce to the control plane (gateway origin), which returns here after sign-in.
    if (state === "anonymous") window.location.href = `${window.location.origin}/`;
  }, [state]);
  return state;
}
