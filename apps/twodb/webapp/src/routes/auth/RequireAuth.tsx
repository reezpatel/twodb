import type { ReactNode } from "react";
import { authClient } from "../../lib/auth-client.js";
import { Login } from "../login/Login.js";

export function RequireAuth(props: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <div>Loading…</div>;
  if (!session) return <Login />;
  return <>{props.children}</>;
}
