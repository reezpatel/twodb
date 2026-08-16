import "@twodb/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import "./index.css";
import { TwoDbPluginProvider } from "@twodb/shared-frontend";

import IdentityPlugin from "@twodb/identity/view";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();
const plugins = [IdentityPlugin];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TwoDbPluginProvider plugins={plugins}>
          <App />
        </TwoDbPluginProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
