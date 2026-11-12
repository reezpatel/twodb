import { AppShell, AppShellBody, AppShellMain } from "@twodb/blocks";
import { DrivePage } from "./drive/DrivePage.js";
import { DriveProvider } from "./drive/hooks/useDrive.js";

/**
 * TwoDrive webapp: an explorer over storage backends (S3-compatible or
 * local) and the virtual storages carved out of them. The sidebar shows
 * backends as collapsible parents with their virtual storages as children —
 * every virtual storage is browsable as its own root.
 */
export function App() {
  return (
    <DriveProvider>
      <AppShell>
        <AppShellBody>
          <AppShellMain>
            <DrivePage />
          </AppShellMain>
        </AppShellBody>
      </AppShell>
    </DriveProvider>
  );
}
