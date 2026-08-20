import "@twodb/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./app";
import "./index";
import { TwoDbPluginProvider } from "@twodb/shared-frontend";

import IdentityPlugin from "@twodb/identity/view";
import ContentPlugin from "@twodb/content/view";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();
const plugins = [IdentityPlugin, ContentPlugin];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TwoDbPluginProvider plugins={plugins}>
        <App />
      </TwoDbPluginProvider>
    </QueryClientProvider>
  </StrictMode>,
);
