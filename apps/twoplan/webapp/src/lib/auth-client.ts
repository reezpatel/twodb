import { createAuthClient } from "better-auth/react";

// Same-origin SSO with the control plane; no TwoPlan login of its own.
export const authClient = createAuthClient({ baseURL: `${window.location.origin}/api/auth`, fetchOptions: { credentials: "include" } });
