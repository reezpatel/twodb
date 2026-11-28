import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TwoDbAuthProvider, RequireTwoDbAuth } from "@twodb/twodb-shared-frontend";
import "@twodb/blocks/styles.css";
import { App } from "./App.js";

// Register the service worker so TwoPin is an installable PWA (share target).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TwoDbAuthProvider>
      <RequireTwoDbAuth>
        <App />
      </RequireTwoDbAuth>
    </TwoDbAuthProvider>
  </StrictMode>,
);

