import { Navigate, Route, Routes } from "react-router";
import { BrowserRouter } from "react-router";
import { RequireAuth } from "./routes/auth/RequireAuth.js";
import { DispatchProvider } from "./lib/dispatch-context.js";
import { ShellChrome } from "./routes/shell/partials/ShellChrome.js";
import { AppHeader } from "./routes/shell/partials/AppHeader.js";
import { useShellSession } from "./routes/shell/hooks/useShellSession.js";
import { useShellNav } from "./routes/shell/hooks/useShellNav.js";
import { useSharedDispatch } from "./lib/dispatch-context.js";
import { RunnersView } from "./routes/runners/RunnersView.js";
import { JobsView } from "./routes/jobs/JobsView.js";
import { JobDetailView } from "./routes/jobs/JobDetailView.js";
import { MicrovmsView } from "./routes/microvms/MicrovmsView.js";
import { MicrovmDetailView } from "./routes/microvms/MicrovmDetailView.js";
import { EnrollTokensView } from "./routes/enroll/EnrollTokensView.js";

/**
 * Routes:
 *   /runners                 — machine registry (status, add, exec, remove)
 *   /jobs                    — job list (filters) + New job
 *   /jobs/:id                — live tail + stdin feed + terminate
 *   /microvms                — microvm lifecycle cards + boot
 *   /microvms/:identifier    — exec console + terminal relay + vscode
 *
 * All domain state (runners/jobs/microvms) lives in one shared context, so
 * mutations in any view refresh what the others see.
 */
export function App() {
  return (
    <RequireAuth>
      <BrowserRouter>
        <DispatchProvider>
          <ShellRoutes />
        </DispatchProvider>
      </BrowserRouter>
    </RequireAuth>
  );
}

function ShellRoutes() {
  const { userName, signOut } = useShellSession();
  const { activeId, onSelect } = useShellNav();
  const { runners, microvms } = useSharedDispatch();

  const title = (() => {
    if (activeId === "enroll") return "Enroll tokens";
    if (activeId.startsWith("jobs:")) return "Job";
    if (activeId.startsWith("microvms:")) return activeId.split(":").slice(1).join(":");
    if (activeId === "runners") return "Runners";
    if (activeId === "jobs") return "Jobs";
    if (activeId === "microvms") return "Microvms";
    return "Dispatch";
  })();

  return (
    <ShellChrome
      runners={runners.runners}
      microvms={microvms.microvms}
      activeId={activeId}
      onSelect={onSelect}
      userName={userName}
      onSignOut={signOut}
      header={
        <AppHeader
          title={title}
          onCreateRunner={(input) => runners.create(input).then((r) => ({ key: r.key })).catch((e) => { throw e; })}
        />
      }
    >
      <Routes>
        <Route path="/runners" element={<RunnersView />} />
        <Route path="/jobs" element={<JobsView />} />
        <Route path="/jobs/:id" element={<JobDetailView />} />
        <Route path="/microvms" element={<MicrovmsView />} />
        <Route path="/microvms/:identifier" element={<MicrovmDetailView />} />
        <Route path="/enroll" element={<EnrollTokensView />} />
        <Route path="*" element={<Navigate to="/runners" replace />} />
      </Routes>
    </ShellChrome>
  );
}
