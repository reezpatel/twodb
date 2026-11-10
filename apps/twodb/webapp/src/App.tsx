import { RequireAuth } from "./routes/auth/RequireAuth.js";
import { GatewayExplorer } from "./routes/explorer/GatewayExplorer.js";
import { AppsRegistry } from "./routes/registry/AppsRegistry.js";
import { HubChrome } from "./routes/shell/partials/HubChrome.js";
import { useHubShell } from "./routes/shell/hooks/useHubShell.js";
import { Toaster } from "./lib/toaster.js";

export function App() {
  const { activeId, onNavSelect, userEmail, userName } = useHubShell();

  return (
    <RequireAuth>
      <HubChrome activeId={activeId} onNavSelect={onNavSelect} userEmail={userEmail} userName={userName}>
        {activeId === "apps" ? <AppsRegistry /> : <GatewayExplorer />}
      </HubChrome>
      <Toaster />
    </RequireAuth>
  );
}
