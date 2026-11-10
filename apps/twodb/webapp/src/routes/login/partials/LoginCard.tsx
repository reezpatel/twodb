"use client";

import * as React from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button, Input, Label, cn } from "@twodb/blocks";

export interface LoginCardProps {
  pending: boolean;
  error: string | null;
  mode: "signin" | "register";
  email: string;
  onModeChange: (mode: "signin" | "register") => void;
  onEmailChange: (email: string) => void;
  onSignIn: () => void;
  onRegister: () => void;
}

/*
 * Login 3 from Hirael <https://hirael.com/blocks/auth/login-03> (MIT)
 * Adapted for the TwoDB Hub: shadcn primitives swapped for @twodb/blocks
 * (same asChild API), the GitHub action re-purposed as passkey auth, and
 * colors mapped onto the Isometric Lab theme tokens (paper/stone/ink/ion).
 * Dumb/presentational only — all auth logic lives in useLogin().
 */

const ENTER = "animate-in fade-in slide-in-from-bottom-4 duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] fill-mode-both motion-reduce:animate-none";

const stagger = (index: number, step = 60): React.CSSProperties => ({
  animationDelay: `${index * step}ms`,
});

const BrandMark = ({ className }: { className?: string }) => {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M2.3 12h2.4v10.95h6.2V14.6h4.6v8.35h6.2V12h-2.4V1.05h-6.2V9.4H8.5V1.05H2.3Z" />
    </svg>
  );
};

const PasskeyIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden {...props}>
    <path
      fill="currentColor"
      d="M9 2a5 5 0 0 0-5 5 5 5 0 0 0 4 4.9V15H6v2h2v3h2v-3h2v-2h-2v-3.1A5 5 0 0 0 14 7a5 5 0 0 0-5-5Zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm9.5 5a2.5 2.5 0 0 0-2.45 2H14v2h2.05a2.5 2.5 0 1 0 2.45-4Z"
    />
  </svg>
);

const jitter = (i: number) => {
  const value = Math.sin(i + 1) * 10_000;
  return value - Math.floor(value);
};

const FloatingPaths = ({ position }: { position: number }) => {
  const reduceMotion = useReducedMotion();
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full text-ion-deep" fill="none" viewBox="0 0 696 316">
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            initial={{ pathLength: 0.3 }}
            animate={reduceMotion ? undefined : { pathLength: 1, pathOffset: [0, 1, 0] }}
            stroke="currentColor"
            className="opacity-60"
            strokeOpacity={0.1 + path.id * 0.03}
            strokeWidth={path.width}
            transition={{
              duration: 20 + jitter(path.id) * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  );
};

/** Dumb/presentational only — renders what useLogin() hands it. */
export function LoginCard(props: LoginCardProps) {
  const { pending, error, mode, email } = props;
  const [redirecting, setRedirecting] = React.useState(false);
  const busy = pending || redirecting;

  const onPrimary = async () => {
    setRedirecting(true);
    try {
      if (mode === "register") await props.onRegister();
      else await props.onSignIn();
    } finally {
      setRedirecting(false);
    }
  };

  return (
    <section data-slot="login" className="relative min-h-svh overflow-hidden bg-paper font-sans lg:grid lg:grid-cols-2">
      <aside data-slot="login-aside" className="relative hidden h-full flex-col overflow-hidden border-e border-outline bg-stone p-10 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, transparent, transparent, var(--paper))",
          }}
        />

        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>

        <div className={cn(ENTER, "relative z-10 flex items-center gap-2")}>
          <BrandMark className="size-6 text-ink" />
          <span className="text-base font-semibold tracking-[-0.025em] text-ink">TwoDB</span>
        </div>

        <figure style={stagger(4)} className={cn(ENTER, "relative z-10 mt-auto flex flex-col gap-3")}>
          <blockquote className="text-2xl leading-[1.25] tracking-tight text-ink md:text-3xl">
            One passkey, one tap — and the whole platform is <span className="italic">ours to bend</span>. One gateway, seventeen apps, zero lock-in.
          </blockquote>
          <figcaption className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            <span>Control plane</span>
            <span aria-hidden className="text-outline">
              |
            </span>
            <span>TwoDB — the everything platform</span>
          </figcaption>
        </figure>
      </aside>

      <div data-slot="login-main" className="relative flex min-h-svh flex-col justify-center px-8 lg:min-h-0">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-60">
          <div
            className="absolute end-0 top-0 h-320 w-140 -translate-y-88 rounded-full"
            style={{
              background:
                "radial-gradient(68.54% 68.72% at 55.02% 31.46%, color-mix(in oklch, var(--ink) 6%, transparent) 0, color-mix(in oklch, var(--ink) 2%, transparent) 50%, color-mix(in oklch, var(--ink) 1%, transparent) 80%)",
            }}
          />
          <div
            className="absolute end-0 top-0 h-320 w-60 translate-x-[5%] -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, var(--ion-deep) 8%, transparent) 0, color-mix(in oklch, var(--ink) 1%, transparent) 80%, transparent 100%)",
            }}
          />
        </div>

        <div data-slot="login-panel" className="relative z-10 mx-auto w-full space-y-6 sm:max-w-sm">
          <div className={cn(ENTER, "flex items-center gap-2 lg:hidden")}>
            <BrandMark className="size-6 text-ink" />
            <span className="text-base font-semibold tracking-[-0.025em] text-ink">TwoDB</span>
          </div>

          <div data-slot="login-header" className="flex flex-col gap-2">
            <h1 style={stagger(1)} className={cn(ENTER, "font-medium tracking-tight text-ink text-3xl")}>
              Sign in or join.
            </h1>
            <p style={stagger(2)} className={cn(ENTER, "pt-4 text-md text-muted-foreground")}>
              One tap with a passkey. No password to remember, no form to fill.
            </p>
          </div>

          {props.error ? (
            <p role="alert" style={stagger(2)} className={cn(ENTER, "rounded-md border border-pin/40 bg-pin/10 px-3 py-2 text-sm text-pin")}>
              {props.error}
            </p>
          ) : null}

          <div style={stagger(3)} className={cn(ENTER, "space-y-3")}>
            {mode === "register" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(e) => props.onEmailChange(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email webauthn"
                    disabled={busy}
                  />
                </div>
                <Button type="button" size="lg" disabled={busy} onClick={onPrimary} className="w-full gap-2">
                  {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <PasskeyIcon className="size-4" />}
                  {busy ? "Waiting for authenticator…" : "Create account + passkey"}
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => props.onModeChange("signin")} className="w-full">
                  <ChevronLeft className="size-4" aria-hidden />
                  Back to sign in
                </Button>
              </>
            ) : (
              <>
                <Button type="button" size="lg" disabled={busy} onClick={onPrimary} className="w-full gap-2">
                  {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <></>}
                  {busy ? "Waiting for authenticator…" : "Continue with passkey"}
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => props.onModeChange("register")} className="w-full">
                  First time? Register a passkey
                </Button>
              </>
            )}
            <span role="status" className="sr-only">
              {busy ? "Waiting for authenticator" : ""}
            </span>
          </div>

          <p style={stagger(4)} className={cn(ENTER, "text-xs text-muted-foreground")}>
            By continuing, a passkey is stored on this device and only this device.{" "}
            <a href="#" className="text-ink underline-offset-4 hover:underline">
              How it works
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
