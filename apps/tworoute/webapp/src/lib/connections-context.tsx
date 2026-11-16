import { createContext, useContext, type ReactNode } from "react";
import { useConnections } from "../routes/connections/hooks/useConnections.js";

/**
 * One shared instance of the connections state at the app level. Without it,
 * every view spinning its own useConnections() sees stale data after a
 * mutation elsewhere (patch in the sidebar wouldn't reach the dashboard's
 * connection list, etc.).
 */
/** Exported for stories/tests that need to feed a mock value into the hook. */
const ConnectionsContext = createContext<ReturnType<typeof useConnections> | null>(null);
export { ConnectionsContext };

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const connections = useConnections();
  return <ConnectionsContext.Provider value={connections}>{children}</ConnectionsContext.Provider>;
}

/** The app-wide connections state — throws if mounted outside the provider. */
export function useSharedConnections(): ReturnType<typeof useConnections> {
  const ctx = useContext(ConnectionsContext);
  if (!ctx) throw new Error("useSharedConnections must be used inside <ConnectionsProvider>");
  return ctx;
}

