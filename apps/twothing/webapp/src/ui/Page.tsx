import type { ReactNode } from "react";
import { cn } from "@twodb/blocks";
import { ArrowLeft } from "lucide-react";
import { back } from "../lib/router";

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 py-5 md:px-8 md:py-8", wide ? "max-w-8xl" : "max-w-6xl", className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions, onBack, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; onBack?: boolean | string; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        {onBack && (
          <button onClick={() => back(typeof onBack === "string" ? onBack : "/")} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Back
          </button>
        )}
        {eyebrow && <div className="mb-1">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-ink-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[18px] border border-outline bg-card p-4 md:p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-wider text-ink-muted uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="size-6 animate-spin rounded-full border-2 border-outline border-t-ink" />
    </div>
  );
}

export const btn = {
  primary: "inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-40",
  secondary: "inline-flex items-center justify-center gap-1.5 rounded-full border border-outline bg-paper px-4 py-2 text-sm font-semibold transition hover:bg-stone active:scale-[0.98] disabled:opacity-40",
  ghost: "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-muted transition hover:bg-stone hover:text-ink disabled:opacity-40",
  danger: "inline-flex items-center justify-center gap-1.5 rounded-full border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-40",
  icon: "grid size-9 place-items-center rounded-full border border-outline bg-paper text-ink transition hover:bg-stone active:scale-95",
};
