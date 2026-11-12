import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@twodb/blocks";

/** A row inside a popover menu (icon + label + optional trailing content). */
export function MenuButton({ icon, children, trailing, danger, active, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; trailing?: ReactNode; danger?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13.5px] text-ink hover:bg-ink/[0.06] disabled:opacity-40",
        danger && "text-destructive",
        active && "bg-ink/[0.06]",
        className,
      )}
      {...props}
    >
      {icon ? <span className={cn("flex size-4 shrink-0 items-center justify-center text-ink-muted", danger && "text-destructive")}>{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing ? <span className="shrink-0 text-xs text-ink-muted">{trailing}</span> : null}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-outline" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2 pb-1 pt-2 text-[11.5px] font-semibold text-ink-muted">{children}</div>;
}
