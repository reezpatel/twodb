import type { ReactNode } from "react";
import { authClient } from "../../lib/auth-client.js";

/**
 * SSO gate: if the shared control-plane session isn't present, send the
 * visitor to the control plane's login (same-origin cookies carry over).
 */
export function RequireAuth(props: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div className="p-6 text-muted-foreground">Loading…</div>;
  // No redirect here: RequireTwoDbAuth (main.tsx) already guarantees a signed-in user, and bouncing to this app's own
  // origin reloads the page into the same gate forever. `session` can be briefly null while the console cookie loads.
  return <>{props.children}</>;
}
