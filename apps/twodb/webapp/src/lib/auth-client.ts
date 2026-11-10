import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";
import { apiKeyClient } from "@better-auth/api-key/client";

// Same origin in every environment: dev goes through the Vite proxy
// (vite.config.ts), prod is served by TwoDB itself. better-auth's client
// requires an absolute URL, so derive it from the window location.
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  fetchOptions: { credentials: "include" },
  plugins: [passkeyClient(), apiKeyClient()],
});
