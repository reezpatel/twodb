import type { ReactNode } from "react";
import { cn } from "@twodb/blocks";

export function Field({ label, hint, children, className, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <div className="text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}

export const inputCls =
  "h-10 w-full rounded-xl border border-outline bg-paper px-3 text-[15px] outline-none transition placeholder:text-ink-muted focus:border-ink/30 focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--ion)_22%,transparent)]";
export const textareaCls =
  "w-full rounded-xl border border-outline bg-paper px-3 py-2 text-[15px] outline-none transition placeholder:text-ink-muted focus:border-ink/30 focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--ion)_22%,transparent)]";

export function Card({ children, className, title, icon }: { children: ReactNode; className?: string; title?: ReactNode; icon?: ReactNode }) {
  return (
    <div className={cn("space-y-4 rounded-[18px] border border-outline bg-card p-4 md:p-5", className)}>
      {title && (
        <div className="flex items-center gap-2 text-[13px] font-semibold tracking-wider text-ink-muted uppercase">
          {icon}
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
