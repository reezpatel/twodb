import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";

// Same-origin SSO with the control plane: the gateway (which this app's API
// calls always go through) resolves the shared better-auth session. No
// separate TwoChat login exists — same pattern as TwoRoute's webapp.
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  fetchOptions: { credentials: "include" },
  plugins: [passkeyClient()],
});
