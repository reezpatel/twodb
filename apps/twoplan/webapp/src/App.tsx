import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from "react-router";
import { authClient } from "./lib/auth-client";
import { MembersProvider } from "./lib/members";
import { Shell } from "./routes/shell/Shell";
import { ProjectsPage } from "./routes/projects/ProjectsPage";
import { ProjectLayout } from "./routes/project/ProjectLayout";
import { TicketsPage } from "./routes/tickets/TicketsPage";
import { TicketPage } from "./routes/ticket/TicketPage";
import { EpicsPage } from "./routes/epics/EpicsPage";
import { EpicDetailPage } from "./routes/epics/EpicDetailPage";
import { MilestonesPage } from "./routes/milestones/MilestonesPage";
import { MilestoneDetailPage } from "./routes/milestones/MilestoneDetailPage";
import { DocsPage } from "./routes/docs/DocsPage";
import { DashboardsPage } from "./routes/dashboards/DashboardsPage";
import { SettingsPage } from "./routes/settings/SettingsPage";
import { InboxPage } from "./routes/inbox/InboxPage";
import { MyWorkPage } from "./routes/inbox/MyWorkPage";
import { PublicSharePage } from "./routes/share/PublicSharePage";

/** SSO gate: no session -> bounce to the control plane's login at the gateway origin. */
function RequireAuth() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <div className="p-6 text-ink-muted">Loading…</div>;
  if (!session) {
    window.location.href = `${window.location.origin}/`;
    return null;
  }
  return <MembersProvider><Outlet /></MembersProvider>;
}

/** /t/PLAN-12 -> /p/PLAN/t/PLAN-12 (so the project context loads). */
function TicketRedirect() {
  const { ident = "" } = useParams();
  return <Navigate to={`/p/${ident.split("-")[0]}/t/${ident}`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/share/:token" element={<PublicSharePage />} />
        <Route element={<RequireAuth />}>
          <Route element={<Shell />}>
            <Route index element={<ProjectsPage />} />
            <Route path="my" element={<MyWorkPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="t/:ident" element={<TicketRedirect />} />
            <Route path="p/:key" element={<ProjectLayout />}>
              <Route index element={<Navigate to="tickets" replace />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="t/:ident" element={<TicketPage />} />
              <Route path="epics" element={<EpicsPage />} />
              <Route path="epics/:id" element={<EpicDetailPage />} />
              <Route path="milestones" element={<MilestonesPage />} />
              <Route path="milestones/:id" element={<MilestoneDetailPage />} />
              <Route path="docs" element={<DocsPage />} />
              <Route path="docs/:id" element={<DocsPage />} />
              <Route path="dashboards" element={<DashboardsPage />} />
              <Route path="dashboards/:id" element={<DashboardsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/:section" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
