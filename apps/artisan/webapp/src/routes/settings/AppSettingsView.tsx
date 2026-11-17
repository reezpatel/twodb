import { CheckCircle2, Download } from "lucide-react";
import { Button } from "@twodb/blocks";
import { useInstallPrompt } from "../shell/hooks/useInstallPrompt.js";

/** App page of the settings dialog — PWA install. */
export function AppSettingsView() {
  const install = useInstallPrompt();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-6 pb-3 pt-5">
        <h1 className="text-[18px] font-semibold">App</h1>
        <p className="mt-0.5 text-[13px] text-ink-muted">Install Artisan on this device for a standalone window and a home-screen icon.</p>
      </header>
      <div className="px-6 pb-5">
        {install.visible ? (
          <Button
            variant="primary"
            onClick={() => {
              void install.install().then((r) => {
                if (r === "manual") window.alert("To install Artisan: open the browser's share menu and choose “Add to Home Screen” / “Install app”.");
              });
            }}
          >
            <Download className="size-3.5" /> Install app
          </Button>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-ink-muted">
            <CheckCircle2 className="size-4 text-info" /> Artisan is installed — you're running it as an app.
          </p>
        )}
      </div>
    </div>
  );
}
