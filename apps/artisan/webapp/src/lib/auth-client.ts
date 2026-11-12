import { createAuthClient } from "better-auth/react";

// Same-origin SSO with the control plane: the gateway (which this app's API
// calls always go through) resolves the shared better-auth session. No
// separate Dispatch login exists — an unauthenticated visit bounces to the
// control plane's login (see RequireAuth).
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  fetchOptions: { credentials: "include" },
  plugins: [],
});
