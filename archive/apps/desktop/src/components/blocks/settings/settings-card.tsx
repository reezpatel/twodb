import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Hairline divider inset 20px from each side, drawn under a row. */
export const SETTINGS_DIVIDER =
  "after:border-foreground/[0.09] after:absolute after:right-5 after:bottom-0 after:left-5 after:border-b-[0.5px] after:content-['']";

/** The settings card: borderless, rounded-sm, muted text. Same surface as the General page blocks. */
export function SettingsCard({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      data-slot="settings-card"
      className={cn("bg-card text-muted-foreground overflow-hidden rounded-sm font-sans text-sm font-[450] tracking-[-0.05px]", className)}
      {...props}
    />
  );
}

/** Icon + muted title, with optional right-hand content, over an inset divider. */
export function SettingsCardHeader({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <header className={cn("relative flex min-h-14 items-center gap-2 px-5 py-3", SETTINGS_DIVIDER)}>
      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <h3 className="text-muted-foreground min-w-0 text-sm leading-5 font-medium">{title}</h3>
      {children ? <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  );
}

/** A row inside the card. Pass `divider` when another row follows. */
export function SettingsCardRow({ divider, className, ...props }: ComponentProps<"div"> & { divider?: boolean }) {
  return <div className={cn("relative px-5 py-4", divider && SETTINGS_DIVIDER, className)} {...props} />;
}

/** Foreground title + muted description pair used by rows. */
export function SettingsRowText({ title, description, htmlFor }: { title: string; description?: ReactNode; htmlFor?: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="text-foreground text-sm font-medium">
        {title}
      </label>
      {description ? <p className="text-muted-foreground/70 text-xs">{description}</p> : null}
    </div>
  );
}
