import { useEffect, useState } from "react";

/** Chrome/Android's deferred install prompt (not standardized; Safari
 * doesn't fire it — there we just don't offer the button). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's legacy standalone flag.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * Business hook: PWA install state. `visible` is true only when the app
 * isn't already installed; when the browser has offered a prompt, `install`
 * triggers it — otherwise the caller should show manual instructions.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    const mql = window.matchMedia("(display-mode: standalone)");
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    mql.addEventListener("change", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mql.removeEventListener("change", onInstalled);
    };
  }, []);

  const install = async (): Promise<"prompted" | "manual"> => {
    if (!deferred) return "manual";
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setDeferred(null);
    return "prompted";
  };

  return { visible: !installed, canPrompt: deferred !== null, install };
}

