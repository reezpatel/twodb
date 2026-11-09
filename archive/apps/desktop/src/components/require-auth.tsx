import { Navigate } from "react-router";
import type { ReactNode } from "react";
import { authClient } from "../lib/auth-client";

export function RequireAuth({ children, requireOrg = false }: { children: ReactNode; requireOrg?: boolean }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <span className="border-primary border-t-primary size-6 animate-spin rounded-full border-2" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (requireOrg && !session.session.activeOrganizationId) {
    return <Navigate to="/orgs" replace />;
  }

  return <>{children}</>;
}
