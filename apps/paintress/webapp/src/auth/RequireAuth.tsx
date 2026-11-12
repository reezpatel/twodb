import type { ReactNode } from "react";
import { useRequireAuth } from "./hooks/useRequireAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const state = useRequireAuth();
  if (state !== "ok") return <div className="p-6 text-ink-muted">Loading…</div>;
  return <>{children}</>;
}
