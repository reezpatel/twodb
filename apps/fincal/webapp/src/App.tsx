import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";
import { authClient } from "./lib/auth-client";
import { SpaceProvider } from "./lib/space";
import { Shell } from "./routes/shell/Shell";
import { SpacesPage } from "./routes/spaces/SpacesPage";
import { OverviewPage } from "./routes/overview/OverviewPage";
import { TransactionsPage } from "./routes/transactions/TransactionsPage";
import { AccountsPage } from "./routes/accounts/AccountsPage";
import { BudgetsPage } from "./routes/budgets/BudgetsPage";
import { EnvelopesPage } from "./routes/envelopes/EnvelopesPage";
import { GoalsPage } from "./routes/goals/GoalsPage";
import { InvestmentsPage } from "./routes/investments/InvestmentsPage";
import { NetWorthPage } from "./routes/networth/NetWorthPage";
import { RetirementPage } from "./routes/retirement/RetirementPage";
import { AnalyticsPage } from "./routes/analytics/AnalyticsPage";
import { CalculatorsPage } from "./routes/calculators/CalculatorsPage";
import { SettingsPage } from "./routes/settings/SettingsPage";

/** SSO gate: no session -> bounce to the control plane's login at the gateway origin. */
function RequireAuth() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <div className="p-6 text-ink-muted">Loading…</div>;
  if (!session) {
    window.location.href = `${window.location.origin}/`;
    return null;
  }
  return <Outlet />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route element={<Shell />}>
            <Route index element={<SpacesPage />} />
            <Route path="s/:spaceId" element={<SpaceProvider><Outlet /></SpaceProvider>}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<OverviewPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="budgets" element={<BudgetsPage />} />
              <Route path="envelopes" element={<EnvelopesPage />} />
              <Route path="goals" element={<GoalsPage />} />
              <Route path="investments" element={<InvestmentsPage />} />
              <Route path="networth" element={<NetWorthPage />} />
              <Route path="retirement" element={<RetirementPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="calculators" element={<CalculatorsPage />} />
              <Route path="calculators/:calcId" element={<CalculatorsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
