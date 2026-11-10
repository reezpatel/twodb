import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router";
import { RequireAuth } from "./routes/auth/RequireAuth.js";
import { GatewayExplorer } from "./routes/explorer/GatewayExplorer.js";
import { AppsRegistry } from "./routes/registry/AppsRegistry.js";
import { ApiKeysView } from "./routes/keys/ApiKeysView.js";
import { SpacesView } from "./routes/spaces/SpacesView.js";
import { HubChrome } from "./routes/shell/partials/HubChrome.js";
import { useHubShell } from "./routes/shell/hooks/useHubShell.js";
import { Toaster } from "./lib/toaster.js";
import { gatewayClient } from "./lib/gateway-client.js";

/**
 * Routes:
 *   /apps             — the registry (all apps in one grid)
 *   /hub/:app/:tab    — gateway explorer, per app + tab (endpoints|messages)
 *   / and /hub        — redirect into the explorer's default app
 *   *                 — back to root
 *
 * The URL is the source of truth for which nav view, app and tab are active;
 * the shell hook mirrors location → nav highlighting.
 */
export function App() {
  return (
    <BrowserRouter>
      <RequireAuth>
        <ShellRoutes />
      </RequireAuth>
      <Toaster />
    </BrowserRouter>
  );
}

/** Inside the router: shell chrome + the route table. */
function ShellRoutes() {
  const { activeId, onNavSelect, userEmail, userName } = useHubShell();

  return (
    <HubChrome activeId={activeId} onNavSelect={onNavSelect} userEmail={userEmail} userName={userName}>
      <Routes>
        <Route path="/apps" element={<AppsRegistry />} />
        <Route path="/hub/:app/:tab" element={<GatewayExplorer />} />
        <Route path="/keys" element={<ApiKeysView />} />
        <Route path="/spaces" element={<SpacesView />} />
        <Route path="/hub" element={<ExplorerRedirect />} />
        <Route path="/" element={<Navigate to="/hub" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HubChrome>
  );
}

/** /hub without an app — jump to the first app with a live contract. */
function ExplorerRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    gatewayClient
      .listApps()
      .then((apps) => {
        const first = apps.find((a) => a.status === "active") ?? apps[0];
        navigate(first ? `/hub/${first.slug}/endpoints` : "/apps", { replace: true });
      })
      .catch(() => navigate("/apps", { replace: true }));
  }, [navigate]);
  return <p className="p-6 text-muted-foreground">Loading…</p>;
}
