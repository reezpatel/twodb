import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __pwaInstallEvent: Event | null;
  }
}

type InstallState = "unsupported" | "promptable" | "installed" | "standalone";

/**
 * PWA install state + trigger. Chrome/Edge fire beforeinstallprompt only after
 * the site passes installability checks, possibly before React mounts —
 * main.tsx stashes the event on window for exactly that case. prompt() resolves
 * the native dialog; the outcome lands via appinstalled / userChoice.
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(() => window.__pwaInstallEvent as BeforeInstallPromptEvent | null);
  const [installed, setInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches);

  useEffect(() => {
    // The pre-mount capture in main.tsx is one-shot; this hook owns the event
    // from here on and clears the stash so install() can't double-fire it.
    const early = window.__pwaInstallEvent as BeforeInstallPromptEvent | null;
    window.__pwaInstallEvent = null;
    if (early) setDeferred(early);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const standalone = installed || window.matchMedia("(display-mode: standalone)").matches;
  const state: InstallState = standalone ? "standalone" : deferred ? "promptable" : "unsupported";

  const install = async () => {
    const event = deferred ?? (window.__pwaInstallEvent as BeforeInstallPromptEvent | null);
    if (!event) return null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
    window.__pwaInstallEvent = null;
    return outcome;
  };

  return { canInstall: state === "promptable", installed: standalone, state, install };
}
