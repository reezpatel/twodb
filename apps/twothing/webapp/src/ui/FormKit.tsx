import type { ReactNode } from "react";

/** Compact 32px text control used by the redesigned forms. */
export const control =
  "h-8 w-full rounded-[6px] border border-ink/20 bg-transparent px-2.5 text-[13px] outline-none transition placeholder:text-ink-muted focus:border-ink/50";

/** Titled bordered card that holds `Row`s. Omit `title` for a heading-less card. */
export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      {title && <h2 className="px-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{title}</h2>}
      <div className="@container overflow-hidden rounded-[6px] border border-outline bg-card">{children}</div>
    </section>
  );
}

/** Label (+ optional hint) on the left, control on the right; stacks on mobile. */
export function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-2 px-4 py-3.5 @lg:grid-cols-[11rem_1fr]">
      <div className="pt-1.5">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] font-light text-ink-muted">{hint}</div>}
      </div>
      <div className="min-w-0 space-y-2">{children}</div>
    </div>
  );
}
