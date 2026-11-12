import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TwoDbAuthProvider, RequireTwoDbAuth } from "@twodb/twodb-shared-frontend";
import "@twodb/blocks/styles.css";

// Starter feature-area skeleton lives at src/feature-x — replace with this
// app's first real pane. Follows the partials/hooks convention from day
// one: see blocks/CONVENTIONS.md.
import { FeatureX } from "./feature-x/FeatureX.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TwoDbAuthProvider>
      <RequireTwoDbAuth>
        <FeatureX />
      </RequireTwoDbAuth>
    </TwoDbAuthProvider>
  </StrictMode>,
);
