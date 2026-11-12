import type { ReactNode } from "react";
import { authClient } from "../../lib/auth-client.js";

/**
 * SSO gate: if the shared control-plane session isn't present, send the
 * visitor to the control plane's login (same-origin cookies carry over).
 */
export function RequireAuth(props: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!session) {
    window.location.href = `${window.location.origin}/`;
    return null;
  }
  return <>{props.children}</>;
}
