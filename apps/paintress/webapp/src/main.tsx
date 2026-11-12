import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TwoDbAuthProvider, RequireTwoDbAuth } from "@twodb/twodb-shared-frontend";
import "@twodb/blocks/styles.css";
import "@xyflow/react/dist/style.css";
import "./paintress.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TwoDbAuthProvider>
      <RequireTwoDbAuth>
        <App />
      </RequireTwoDbAuth>
    </TwoDbAuthProvider>
  </StrictMode>,
);
