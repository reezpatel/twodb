import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";

// Same-origin SSO with the control plane (same pattern as TwoChat): the
// Gateway resolves the shared better-auth session; no separate login here.
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  fetchOptions: { credentials: "include" },
  plugins: [passkeyClient()],
});
