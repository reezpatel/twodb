import { createAuthClient } from "better-auth/react";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { apiKeyClient } from "@better-auth/api-key/client";
import { getAuthToken, getServerUrl, isNative, setAuthToken } from "./native";

const server = getServerUrl();

export const authClient = createAuthClient({
  // Web: same-origin /api (vite proxy in dev, the server's static hosting in
  // prod). Native: the user-chosen server, authenticated with a bearer token
  // captured from the `set-auth-token` response header.
  ...(server ? { baseURL: `${server}/api/auth` } : {}),
  fetchOptions: {
    credentials: "include",
    ...(isNative
      ? {
          auth: { type: "Bearer", token: () => getAuthToken() ?? "" },
          onSuccess: (ctx) => {
            const token = ctx.response.headers.get("set-auth-token");
            if (token) setAuthToken(token);
          },
        }
      : {}),
  },
  plugins: [adminClient(), organizationClient(), passkeyClient(), apiKeyClient()],
});
