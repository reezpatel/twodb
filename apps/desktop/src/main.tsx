import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { registerSW } from "virtual:pwa-register";
import { router } from "./router";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@fontsource-variable/outfit";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";

const queryClient = new QueryClient();

// Captured before React mounts — if Chrome fires beforeinstallprompt while the
// bundle is still loading, the settings Install button can still use it.
window.__pwaInstallEvent = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__pwaInstallEvent = e;
});

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
