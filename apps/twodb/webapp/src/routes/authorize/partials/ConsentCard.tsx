import { Button, cn } from "@twodb/blocks";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import twodbMark from "../../../assets/twodb-mark.png";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-all">{children}</dd>
    </div>
  );
}

export interface ConsentCardProps extends ComponentPropsWithoutRef<"div"> {
  /** Display name of the app asking to sign in (its host). */
  appName: string;
  /** Origin the browser will be sent back to. */
  target: string;
  email: string;
  error?: string | null;
  pending?: boolean;
  onApprove: () => void;
  onDeny: () => void;
}

/** Consent card for "Login with TwoDB": app ⟷ TwoDB badge pair, the request details, Deny / Continue. */
export function ConsentCard({ appName, target, email, error, pending, onApprove, onDeny, className, ...props }: ConsentCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-sm animate-in overflow-hidden rounded-2xl border border-outline bg-card text-ink shadow-lg duration-500 fade-in-0 zoom-in-95",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col items-center px-8 pt-9 pb-6 text-center">
        <div className="flex items-center" role="img" aria-label={`${appName} connecting to TwoDB`}>
          {/* Every app is a PWA and serves this icon (see its manifest). No fallback: a non-PWA app shows a broken image. */}
          <img src={`${target}/icons/icon-192.png`} alt={appName} className="size-12 rounded-full border border-outline bg-paper object-cover" />
          <div className="h-px w-8 bg-outline" aria-hidden="true" />
          <img src={twodbMark} alt="" className="size-12 rounded-full border border-outline bg-paper object-cover" />
        </div>
        <h1 className="mt-5 text-xl font-medium tracking-[-0.01em]">Sign in to {appName}</h1>
        <p className="mt-1.5 text-sm font-light text-ink-muted">Review who is asking before you continue.</p>
      </div>

      <div className="space-y-5 px-8 pb-8">
        <dl className="divide-y divide-outline rounded-lg border border-outline text-sm">
          <Row label="App">{appName}</Row>
          <Row label="Returns to">{target}</Row>
          <Row label="Signing in as">{email}</Row>
        </dl>
        <p className="text-[13px] font-light text-ink-muted">Continue only if you recognize this app. Once you do, it can act as you within TwoDB.</p>
        {error ? (
          <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={pending} onClick={onDeny}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={onApprove}>
            {pending ? "Signing in…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
