import { useState, type ReactNode } from "react";
import { Button } from "@twodb/blocks";
import twodbMark from "./assets/twodb-mark.png";
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

/** The app's own icon, borrowed from the page (apple-touch-icon / icon link); undefined when the app has none. */
function pageIcon(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const link = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]') ?? document.querySelector<HTMLLinkElement>('link[rel~="icon"][sizes="32x32"], link[rel~="icon"]');
  return link?.href || undefined;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

/** Decorative, deterministic barcode (same app → same bars). Pure flavour, carries no data. */
function PassBarcode({ seed }: { seed: string }) {
  let h = 0;
  for (const ch of seed) h = (Math.imul(31, h) + ch.charCodeAt(0)) | 0;
  const rand = (i: number) => {
    const x = Math.sin(h + i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  const bars = Array.from({ length: 46 }, (_, i) => (rand(i) > 0.68 ? 2.5 : 1.4));
  const gap = 1.6;
  const total = bars.reduce((a, w) => a + w + gap, 0) - gap;
  let x = (240 - total) / 2;
  return (
    <svg viewBox="0 0 240 36" className="h-9 w-full max-w-60 fill-current text-ink/70" aria-hidden="true">
      {bars.map((w, i) => {
        const rx = x;
        x += w + gap;
        return <rect key={i} x={rx} y="0" width={w} height="36" />;
      })}
    </svg>
  );
}

/** Half-circle cut-outs on both sides of the tear line (clipped by the card's overflow-hidden). */
function TearLine() {
  return (
    <div className="relative h-0" aria-hidden="true">
      <span className="absolute top-1/2 -left-4 size-8 -translate-y-1/2 rounded-full border border-outline bg-paper" />
      <span className="absolute top-1/2 -right-4 size-8 -translate-y-1/2 rounded-full border border-outline bg-paper" />
      <div className="mx-6 border-t-2 border-dashed border-outline" />
    </div>
  );
}

/** Pill-shaped "tear-off" sign-in action: the TwoDB logo on the left, label in the middle, arrow that nudges on hover. */
function PassButton({ label }: { label: string }) {
  const { login } = useTwoDbAuth();
  return (
    <button
      type="button"
      onClick={() => void login()}
      className="group relative flex h-12 w-full items-center gap-3 overflow-hidden rounded-full bg-ink pr-1.5 pl-1.5 text-paper shadow-md outline-none transition hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ion-deep focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.985]"
    >
      <img src={twodbMark} alt="" className="size-9 shrink-0 rounded-full bg-paper object-cover" />
      <span className="flex-1 text-center text-[14px] font-medium tracking-[-0.005em]">{label}</span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper/12 transition group-hover:translate-x-0.5 group-hover:bg-paper/20" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}

/** Shows a ticket-style sign-in pass until the user is signed in; renders children afterwards. */
export function RequireTwoDbAuth(props: { children: ReactNode; title?: string; description?: string; appName?: string; fallback?: ReactNode }) {
  const { status, error } = useTwoDbAuth();
  const [iconFailed, setIconFailed] = useState(false);
  if (status === "loading") return <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">Loading…</div>;
  if (status === "authenticated") return <>{props.children}</>;
  if (props.fallback) return <>{props.fallback}</>;

  const appName = props.appName ?? (typeof document !== "undefined" ? document.title.split(/[\u2013\u2014|·-]/)[0].trim() : "") ?? "";
  const icon = iconFailed ? undefined : pageIcon();
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="relative w-full max-w-sm animate-in overflow-hidden rounded-2xl border border-outline bg-card text-ink shadow-lg duration-500 fade-in-0 zoom-in-95">
        <div className="flex flex-col items-center px-8 pt-9 pb-8 text-center">
          <div className="grid size-14 place-items-center overflow-hidden rounded-2xl border border-outline bg-paper text-ink-muted">
            {icon ? <img src={icon} alt="" className="size-full object-cover" onError={() => setIconFailed(true)} /> : <LockIcon />}
          </div>
          <h1 className="mt-5 text-xl font-medium tracking-[-0.01em]">{props.title ?? (appName ? `Sign in to ${appName}` : "Sign in to continue")}</h1>
          <p className="mt-1.5 text-sm font-light text-ink-muted">{props.description ?? "Continue with your TwoDB account. One sign-in works across all your apps."}</p>
        </div>

        <TearLine />

        <div className="space-y-5 px-8 pt-8 pb-7">
          {error ? (
            <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <PassButton label="Continue with TwoDB" />
          <div className="flex flex-col items-center gap-2 pt-1">
            <PassBarcode seed={appName || "twodb"} />
            <p className="text-[11px] tracking-[0.3em] text-ink-muted uppercase">Secured by TwoDB</p>
          </div>
        </div>
      </div>
    </div>
  );
}
