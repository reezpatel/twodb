import { AppShell, AppShellBody, AppShellMain, AppShellHeader, AppShellContent } from "@twodb/blocks";
import { RequireAuth } from "./routes/auth/RequireAuth.js";
import { AppsRegistry } from "./routes/registry/AppsRegistry.js";

export function App() {
  return (
    <RequireAuth>
      <AppShell>
        <AppShellBody>
          <AppShellMain>
            <AppShellHeader>TwoDB — control plane</AppShellHeader>
            <AppShellContent>
              <AppsRegistry />
            </AppShellContent>
          </AppShellMain>
        </AppShellBody>
      </AppShell>
    </RequireAuth>
  );
}
