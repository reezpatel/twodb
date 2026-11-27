import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TwoDbAuthProvider, RequireTwoDbAuth } from "@twodb/twodb-shared-frontend";
import "@twodb/blocks/styles.css";
import "./styles.css";
import { App } from "./App";
import { registerServiceWorker } from "./register-sw";

registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {__TWOTHING_NO_AUTH__ ? (
      // TWOTHING_DIRECT=1 dev mode: straight to the backend, no gateway, no login.
      <App />
    ) : (
      <TwoDbAuthProvider>
        <RequireTwoDbAuth>
          <App />
        </RequireTwoDbAuth>
      </TwoDbAuthProvider>
    )}
  </StrictMode>,
);
