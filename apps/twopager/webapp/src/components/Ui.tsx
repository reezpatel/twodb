import type { ReactNode } from "react";
import { Label } from "@twodb/blocks";
import { HeaderPortal } from "../lib/header-slot";

export const selectCls = "h-9 w-full rounded-md border border-outline bg-paper px-2.5 text-sm text-ink outline-none focus:border-ion-deep";
export const cardCls = "rounded-xl border border-outline bg-card";

/** Title (+ short mono subtitle) and actions go to the shell header; `description` stays in the page as an intro line. */
export function PageHeader({ title, subtitle, description, actions }: { title: string; subtitle?: string; description?: string; actions?: ReactNode }) {
  return (
    <>
      <HeaderPortal>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold leading-none text-ink">{title}</h1>
            {subtitle ? <p className="mt-1 truncate font-mono text-[11px] leading-none text-ink-muted">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      </HeaderPortal>
      {description ? <p className="mb-4 text-[12px] text-ink-muted">{description}</p> : null}
    </>
  );
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
      <div className={`mx-auto w-full ${wide ? "max-w-7xl" : "max-w-6xl"}`}>{children}</div>
    </div>
  );
}

export function Section({ title, actions, children, className = "" }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${cardCls} p-3 sm:p-4 ${className}`}>
      {title || actions ? <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2>{actions}</div> : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "muted" }) {
  const c = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "";
  return (
    <div className={`${cardCls} p-4`}>
      <div className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${c}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-ink-muted">{sub}</div> : null}
    </div>
  );
}

export function Progress({ pct, color = "var(--color-ion-deep, #6366f1)", over = false, className = "" }: { pct: number; color?: string; over?: boolean; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-paper-grid ${className}`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: over ? "#ef4444" : color }} />
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-outline px-6 py-12 text-center">
      <div className="font-medium">{title}</div>
      {hint ? <p className="max-w-md text-sm text-ink-muted">{hint}</p> : null}
      {action}
    </div>
  );
}

export const Spinner = ({ label = "Loading…" }: { label?: string }) => <div className="p-6 text-sm text-ink-muted">{label}</div>;

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return <div className={className}><Label>{label}</Label>{children}{hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}</div>;
}

export function Swatch({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />;
}

/** Colours a signed amount: income/positive green, expense/negative red. */
export const amountCls = (n: number) => (n > 0 ? "text-success" : n < 0 ? "text-destructive" : "");
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
