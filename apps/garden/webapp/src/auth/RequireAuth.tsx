import type { ReactNode } from "react";
import { Sprout } from "lucide-react";
import { useRequireAuth } from "./useRequireAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const state = useRequireAuth();
  if (state === "ok") return <>{children}</>;
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 bg-paper text-ink-muted">
      <Sprout size={22} className="text-ink" />
      {state === "loading" ? "Loading…" : <span>You're signed out. <a className="text-ion-deep underline" href="/">Sign in to TwoDB</a> and come back.</span>}
    </div>
  );
}
