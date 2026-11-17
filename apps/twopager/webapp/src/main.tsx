import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TwoDbAuthProvider, RequireTwoDbAuth } from "@twodb/twodb-shared-frontend";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@twodb/blocks/styles.css";
import { App } from "./App";
import { applyStoredTheme } from "./lib/theme";
import { registerServiceWorker } from "./register-sw";

applyStoredTheme();
registerServiceWorker();
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TwoDbAuthProvider>
        <RequireTwoDbAuth>
          <App />
        </RequireTwoDbAuth>
      </TwoDbAuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
