import { createAuthClient } from "better-auth/react";
import { authBaseUrl } from "@twodb/twodb-shared-frontend";

// SSO with the control plane: auth lives on the CONSOLE origin (an app origin only serves its own /api).
export const authClient = createAuthClient({
  baseURL: authBaseUrl(),
  fetchOptions: { credentials: "include" },
  plugins: [],
});
