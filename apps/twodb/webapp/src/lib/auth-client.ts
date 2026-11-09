import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";
import { apiKeyClient } from "@better-auth/api-key/client";

/** Same-origin /api/auth in dev via the vite proxy (see vite.config.ts), same in prod once TwoDB serves this build. */
export const authClient = createAuthClient({
  baseURL: "/api/auth",
  fetchOptions: { credentials: "include" },
  plugins: [passkeyClient(), apiKeyClient()],
});
