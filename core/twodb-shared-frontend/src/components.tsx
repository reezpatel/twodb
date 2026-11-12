import type { ReactNode } from "react";
import { Button } from "@twodb/blocks";
import { useTwoDbAuth } from "./provider.js";

/** The one sign-in affordance: sends the browser to TwoDB. */
export function LoginWithTwoDbButton(props: { label?: string; className?: string }) {
  const { login } = useTwoDbAuth();
  return (
    <Button className={props.className} onClick={() => void login()}>
      {props.label ?? "Login using TwoDB"}
    </Button>
  );
}

/** Shows the login button until the user is signed in; renders children afterwards. */
export function RequireTwoDbAuth(props: { children: ReactNode; title?: string; description?: string; fallback?: ReactNode }) {
  const { status, error } = useTwoDbAuth();
  if (status === "loading") return <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">Loading…</div>;
  if (status === "authenticated") return <>{props.children}</>;
  if (props.fallback) return <>{props.fallback}</>;
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-md border border-outline bg-card p-8 text-center text-ink">
        <h1 className="text-lg font-semibold tracking-[-0.01em]">{props.title ?? "Sign in to continue"}</h1>
        <p className="text-sm text-ink-muted">{props.description ?? "This app uses your TwoDB account."}</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <LoginWithTwoDbButton className="w-full" />
      </div>
    </div>
  );
}
