import { Navigate, Route, Routes, useParams } from "react-router";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@twodb/blocks";
import { RequireAuth } from "./routes/auth/RequireAuth.js";
import { BrowserRouter } from "react-router";
import { ShellChrome } from "./routes/shell/partials/ShellChrome.js";
import { AppHeader, type AppHeaderProps } from "./routes/shell/partials/AppHeader.js";
import { useShellSession } from "./routes/shell/hooks/useShellSession.js";
import { useSidebarToggle } from "./routes/shell/hooks/useSidebarToggle.js";
import { useDetailPanel } from "./routes/shell/hooks/useDetailPanel.js";
import { useInstallPrompt } from "./routes/shell/hooks/useInstallPrompt.js";
import { useShellNav } from "./routes/shell/hooks/useShellNav.js";
import { ConnectionDetailSidebar } from "./routes/connections/partials/ConnectionDetailSidebar.js";
import { ConnectionsProvider, useSharedConnections } from "./lib/connections-context.js";
import { Dashboard } from "./routes/dashboard/Dashboard.js";

/**
 * Routes:
 *   /                        — aggregate dashboard (all connections)
 *   /connections/:name       — one connection's dashboard + detail sidebar
 *
 * The shared connection state (list, providers, spaces, mutations) lives at
 * the shell level: the app header's Add-connection / Edit / Refresh-models
 * actions and every view below see the same data.
 */
export function App() {
  return (
    <RequireAuth>
      <BrowserRouter>
        <ConnectionsProvider>
          <ShellRoutes />
        </ConnectionsProvider>
      </BrowserRouter>
    </RequireAuth>
  );
}

function ShellRoutes() {
  const { userName, signOut } = useShellSession();
  const installPrompt = useInstallPrompt();
  const { connections, activeId, onSelect } = useShellNav();
  const conn = useSharedConnections();
  const [quotaSweep, setQuotaSweep] = useState<null | { ok: number; error: number; skipped: number }>(null);

  const { open: navOpen, toggle: toggleNav, setOpen: setNavOpen, overlay: navOverlay } = useSidebarToggle("tworoute.nav-open");
  const activeConnection = activeId === "dashboard" ? null : (connections.find((c) => c.name === activeId) ?? null);
  /** Detail panel: docked on lg+, overlay sheet below lg (closed by default). */
  const { open: detailOpen, setOpen: setDetailOpen, toggle: toggleDetail } = useDetailPanel();

  // Lazily pull models + usage for the detail sidebar when entering a
  // connection page.
  useEffect(() => {
    if (activeConnection) void conn.loadModels(activeConnection.id);
  }, [activeConnection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshAllQuotas = async () => {
    setQuotaSweep(null);
    const result = await conn.refreshAllQuotas();
    if (result) {
      setQuotaSweep({
        ok: result.results.filter((r) => r.status === "ok").length,
        error: result.results.filter((r) => r.status === "error").length,
        skipped: result.results.filter((r) => r.status === "skipped").length,
      });
    }
  };

  const headerProps: AppHeaderProps = {
    title: activeConnection ? activeConnection.name : activeId === "manage" ? "Manage connections" : "Dashboard",
    subtitle: "",
    connections,
    spaces: conn.spaces,
    providers: conn.providers,
    activeConnection,
    busy: conn.busy,
    oauthBusy: conn.busy,
    onCreate: (values) => void conn.create(values),
    onEdit: (id, values) =>
      void conn.patch(id, {
        name: values.name,
        spaceIds: values.spaceIds,
        baseUrl: values.baseUrl,
        defaultModel: values.defaultModel ?? null,
        apiKey: values.apiKey,
        config: values.config,
      }),
    onRefreshModels: (id) => void conn.refreshModelsFor(id),
    onRunOauth: conn.runOauth,
    onCompleteOauth: conn.completeOauth,
    actions: (
      <div className="flex items-center gap-2">
        {activeConnection ? (
          <Button
            size="sm"
            variant="ghost"
            className="lg:hidden"
            aria-label="Toggle connection details"
            aria-expanded={detailOpen}
            onClick={toggleDetail}
          >
            Details
          </Button>
        ) : null}
        {quotaSweep ? (
          <span className="hidden text-[11px] text-ink-muted sm:inline">
            {quotaSweep.ok} ok · {quotaSweep.error} failed · {quotaSweep.skipped} skipped
          </span>
        ) : null}
        <Button size="sm" variant="ghost" disabled={conn.busy} aria-label="Refresh quotas" onClick={() => void refreshAllQuotas()}>
          <RefreshCw className="size-3.5" />
          <span className="hidden sm:inline">Refresh quotas</span>
        </Button>
      </div>
    ),
  };

  return (
    <ShellChrome
      connections={connections}
      activeId={activeId}
      onSelect={(id) => {
        onSelect(id);
        if (navOverlay) setNavOpen(false);
      }}
      userName={userName}
      onSignOut={signOut}
      canInstall={installPrompt.visible}
      onInstall={() => {
        void installPrompt.install().then((result) => {
          // No native prompt available (e.g. iOS Safari) — guide the user.
          if (result === "manual") {
            window.alert(
              "To install TwoRoute: open the browser's share menu and choose “Add to Home Screen”.",
            );
          }
        });
      }}
      navOpen={navOpen}
      onToggleNav={toggleNav}
      onNavOpenChange={setNavOpen}
      header={<AppHeader {...headerProps} />}
      sidebar={
        activeConnection ? (
          <ConnectionDetailSidebar
            connection={activeConnection}
            providerLabel={conn.providerLabel(activeConnection.provider)}
            spaceName={conn.spaceNames(activeConnection.spaceIds ?? [activeConnection.spaceId])}
            quotas={conn.quotas.filter((q) => q.connectionId === activeConnection.id)}
            usage={conn.usage[activeConnection.id] ?? null}
            models={conn.models[activeConnection.id] ?? null}
            busy={conn.busy}
            testResult={conn.tests[activeConnection.id] ?? null}
            open={detailOpen}
            onOpenChange={setDetailOpen}
            onTest={() => void conn.test(activeConnection.id)}
            onLoadModels={() => void conn.loadModels(activeConnection.id)}
            onRefreshModels={() => void conn.refreshModelsFor(activeConnection.id)}
            onRefreshQuotas={() => void conn.refreshQuotasFor(activeConnection.id)}
            onRemove={() => void conn.remove(activeConnection.id)}
            onSetDefault={(modelId) => void conn.patch(activeConnection.id, { defaultModel: modelId })}
          />
        ) : undefined
      }
    >
      <Routes>
        <Route path="/" element={<Dashboard scope={null} />} />
        <Route path="/connections/:name" element={<ConnectionDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShellChrome>
  );
}

function ConnectionDashboard() {
  const { name } = useParams();
  return <Dashboard scope={name ?? null} />;
}
