import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { apiKeyClient } from "@better-auth/api-key/client";

export const authClient = createAuthClient({
  // Same-origin /api — the vite proxy (dev), tauri (desktop), and the server's
  // own static hosting (prod) all route it identically. No absolute API URL.
  fetchOptions: { credentials: "include" },
  plugins: [adminClient(), organizationClient(), passkeyClient(), apiKeyClient()],
});
