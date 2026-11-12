import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router";
import { RequireAuth } from "./routes/auth/RequireAuth.js";
import { Authorize } from "./routes/authorize/Authorize.js";
import { AppDetails } from "./routes/app-details/AppDetails.js";
import { AppsRegistry } from "./routes/registry/AppsRegistry.js";
import { ApiKeysView } from "./routes/keys/ApiKeysView.js";
import { SpacesView } from "./routes/spaces/SpacesView.js";
import { HubChrome } from "./routes/shell/partials/HubChrome.js";
import { useHubShell } from "./routes/shell/hooks/useHubShell.js";
import { useBreadcrumbs } from "./routes/shell/hooks/useBreadcrumbs.js";
import { Toaster } from "./lib/toaster.js";

/**
 * Routes:
 *   /apps             — the registry (all apps in one table)
 *   /app/:slug/:tab   — one app's details, tab = endpoints|messages
 *   / and /hub        — redirect to /apps (/hub/:slug/:tab → /app/:slug/:tab)
 *   *                 — back to root
 *
 * The URL is the source of truth for which nav view, app and tab are active;
 * the shell hook mirrors location → nav highlighting.
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* "Login with TwoDB" — outside the hub chrome */}
        <Route path="/authorize" element={<RequireAuth><Authorize /></RequireAuth>} />
        <Route path="*" element={<RequireAuth><ShellRoutes /></RequireAuth>} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

/** Inside the router: shell chrome + the route table. */
function ShellRoutes() {
  const { activeId, navOpen, toggleNav, onNavSelect, userEmail, userName } = useHubShell();
  const crumbs = useBreadcrumbs();

  return (
    <HubChrome activeId={activeId} navOpen={navOpen} onToggleNav={toggleNav} onNavSelect={onNavSelect} userEmail={userEmail} userName={userName} crumbs={crumbs}>
      <Routes>
        <Route path="/apps" element={<AppsRegistry />} />
        {/* Not /apps/:slug — that prefix is the gateway's app proxy (dev proxy + production). */}
        <Route path="/app/:slug" element={<Navigate to="endpoints" replace />} />
        <Route path="/app/:slug/:tab" element={<AppDetails />} />
        <Route path="/keys" element={<ApiKeysView />} />
        <Route path="/spaces" element={<SpacesView />} />
        {/* Old explorer URLs */}
        <Route path="/hub/:slug/:tab" element={<LegacyHubRedirect />} />
        <Route path="/hub" element={<Navigate to="/apps" replace />} />
        <Route path="/" element={<Navigate to="/apps" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HubChrome>
  );
}

/** /hub/:slug/:tab (the old gateway explorer) → /app/:slug/:tab */
function LegacyHubRedirect() {
  const { slug, tab } = useParams();
  return <Navigate to={`/app/${slug}/${tab ?? "endpoints"}`} replace />;
}
