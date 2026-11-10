import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { useSharedConnections } from "../../../lib/connections-context.js";

/**
 * Business hook for the shell nav: connection entries come from the SHARED
 * connections state (so patches refresh them everywhere); active id derives
 * from the URL, and selection navigates.
 */
export function useShellNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { connections } = useSharedConnections();

  /** /connections/:name → that connection's nav id; anything else → the aggregate dashboard. */
  const match = location.pathname.match(/^\/connections\/([^/]+)$/);
  const activeId = match ? decodeURIComponent(match[1]) : "dashboard";

  const onSelect = useCallback(
    (id: string) => {
      if (id === "dashboard") navigate("/");
      else navigate(`/connections/${encodeURIComponent(id)}`);
    },
    [navigate],
  );

  return { connections, activeId, onSelect };
}
