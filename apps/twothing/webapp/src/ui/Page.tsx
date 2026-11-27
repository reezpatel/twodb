import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@twodb/blocks";
import { Breadcrumb, type Crumb } from "./Breadcrumb";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-8xl px-4 py-5 md:px-8 md:py-8", className)}>{children}</div>;
}

export const HEADER_SLOT_ID = "tt-header-title";

const CRUMBS: Record<string, string> = { "/items": "Items", "/places": "Places", "/labels": "Labels" };

/** Page title goes into the top header bar (portal) as a breadcrumb — `Parent / Title` when `onBack` names a parent, just `Title` on root pages. Eyebrow and actions stay in the page. */
export function PageHeader({
  title,
  actions,
  onBack,
  eyebrow,
  trail,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onBack?: boolean | string;
  eyebrow?: ReactNode;
  /** Extra crumbs between the parent link and the title (e.g. a place's ancestors). */
  trail?: Crumb[];
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setSlot(document.getElementById(HEADER_SLOT_ID)), []);
  const hasBody = eyebrow || actions;
  const parent = typeof onBack === "string" ? onBack : undefined;
  const items: Crumb[] = [...(parent && CRUMBS[parent] ? [{ label: CRUMBS[parent], to: parent }] : []), ...(trail ?? []), { label: title }];
  return (
    <>
      {slot && createPortal(<Breadcrumb items={items} onBack={onBack} />, slot)}
      {hasBody && (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">{eyebrow}</div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </>
  );
}

export function Section({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[6px] border border-outline bg-card p-4 md:p-5", className)}>
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
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-40",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-outline bg-paper px-4 py-2 text-sm font-semibold transition hover:bg-stone active:scale-[0.98] disabled:opacity-40",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-[6px] px-3 py-2 text-sm font-semibold text-ink-muted transition hover:bg-stone hover:text-ink disabled:opacity-40",
  danger:
    "inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-40",
  icon: "grid size-9 place-items-center rounded-[6px] border border-outline bg-paper text-ink transition hover:bg-stone active:scale-95",
};

/** Compact 32px controls used on the redesigned pages. */
export const cbtn = {
  secondary:
    "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[6px] border border-ink/20 bg-transparent px-3 text-[12px] font-medium transition hover:bg-stone active:scale-[0.98] disabled:opacity-40",
  primary:
    "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[6px] bg-ink px-3 text-[12px] font-medium text-paper transition hover:bg-ink/90 active:scale-[0.98] disabled:opacity-40",
};
