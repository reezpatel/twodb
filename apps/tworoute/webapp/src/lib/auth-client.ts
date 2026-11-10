import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";

// Same-origin SSO with the control plane: the gateway (which this app's API
// calls always go through) resolves the shared better-auth session. No
// separate TwoRoute login exists — an unauthenticated visit here means the
// session is absent, and RequireAuth bounces to the control plane's login.
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  fetchOptions: { credentials: "include" },
  plugins: [passkeyClient()],
});
